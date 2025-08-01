// scripts/sheets/group-sheet.js
import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { GroupLinkers } from './group-linkers.js';

export class GroupSheet extends CampaignCodexBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, "group-sheet"],
      width: 1200,
      height: 800
    });
  }

  get template() {
    return "modules/campaign-codex/templates/group-sheet.html";
  }

  async getData() {
    const data = await super.getData();
    const groupData = this.document.getFlag("campaign-codex", "data") || {};

    // Get all nested data
    data.groupMembers = await GroupLinkers.getGroupMembers(groupData.members || []);
    data.nestedData = await GroupLinkers.getNestedData(data.groupMembers);
    
    // Sheet configuration
    data.sheetType = "group";
    data.sheetTypeLabel = "Group Overview";
    data.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'group');
    
    // Navigation tabs with counts
    data.tabs = [
      { key: 'info', label: 'Overview', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'npcs', label: 'NPCs', icon: TemplateComponents.getAsset('icon', 'npc'), active: this._currentTab === 'npcs',
        statistic: { value: data.nestedData.allNPCs.length, color: '#fd7e14' }
      },
      { key: 'inventory', label: 'Inventory', icon: 'fas fa-boxes', active: this._currentTab === 'inventory',
        statistic: { value: data.nestedData.allItems.length, color: '#28a745' }
      },
      { key: 'locations', label: 'Locations', icon: TemplateComponents.getAsset('icon', 'location'), active: this._currentTab === 'locations',
        statistic: { value: data.nestedData.allLocations.length, color: '#17a2b8' }
      },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];

    // Left panel tree structure
    data.leftPanel = this._generateLeftPanel(data.groupMembers, data.nestedData);
    
    // Tab panels
    data.tabPanels = [
      {
        key: 'info',
        active: this._currentTab === 'info',
        content: this._generateInfoTab(data)
      },
      {
        key: 'npcs',
        active: this._currentTab === 'npcs',
        content: this._generateNPCsTab(data)
      },
      {
        key: 'inventory',
        active: this._currentTab === 'inventory',
        content: this._generateInventoryTab(data)
      },
      {
        key: 'locations',
        active: this._currentTab === 'locations',
        content: this._generateLocationsTab(data)
      },
      {
        key: 'notes',
        active: this._currentTab === 'notes',
        content: CampaignCodexBaseSheet.generateNotesTab(data)
      }
    ];
    
    return data;
  }

activateListeners(html) {
  // Call the parent class to inherit its listeners
  super.activateListeners(html);

  // Explicitly set up drop and dragover listeners for this sheet
  // html[0].addEventListener('drop', this._onDrop.bind(this));
  // html[0].addEventListener('dragover', this._onDragOver.bind(this));

  // Group-specific setup
  this._setupGroupTabs(html);

  // Tree navigation
  html.find('.tree-node-header.expandable').click(this._onToggleTreeNode.bind(this));
  html.find('.btn-expand-all').click(this._onExpandAll.bind(this));
  html.find('.btn-collapse-all').click(this._onCollapseAll.bind(this));

  // Sheet opening
  html.find('.btn-open-sheet').click(this._onOpenSheet.bind(this));
  html.find('.btn-open-actor').click(this._onOpenActor.bind(this));

  // Group management
  html.find('.btn-remove-member').click(this._onRemoveMember.bind(this));
  html.find('.btn-focus-item').click(this._onFocusItem.bind(this));

  // Filters
  html.find('.filter-btn').click(this._onFilterChange.bind(this));

  // Group tabs
  html.find('.group-tab').click(this._onTabChange.bind(this));
}

async _handleDrop(data, event) {
  if (data.type === "JournalEntry") {
    const journal = await fromUuid(data.uuid);
    if (journal && journal.getFlag("campaign-codex", "type")) {
      await this._addMemberToGroup(journal.uuid);
    }
  } else if (data.type === "Actor") {
    // Auto-create NPC journal and add it to the group
    const actor = await fromUuid(data.uuid);
    const npcJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(actor);
    if (npcJournal) {
      await this._addMemberToGroup(npcJournal.uuid);
    }
  }
}

  async _onDrop(event) {
    event.preventDefault();
        // console.log(event);
    if (this._dropping) return;
    this._dropping = true;
    
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      this._dropping = false;
      return; // Exit if data is not valid JSON
    }

    try {
      // Directly call the handler without trying to save a non-existent form
      await this._handleDrop(data, event);
      
      // Refresh the sheet to show the new member
      this.render(false);
      
    } catch (error) {
      console.error('Campaign Codex | Error handling group drop:', error);
    } finally {
      this._dropping = false;
    }
  }

_onDragOver(event) {
  event.preventDefault();
          // console.log(event);
  event.dataTransfer.dropEffect = "link";
}

  _setupGroupTabs(html) {
    html.find('.group-tab').click(event => {
      event.preventDefault();
      const tab = event.currentTarget.dataset.tab;
      this._currentTab = tab;
      this._showGroupTab(tab, html);
    });

    this._showGroupTab(this._currentTab, html);
  }

  _generateLeftPanel(groupMembers, nestedData) {
    return `
      <div class="group-tree">
        <div class="tree-header">
          <h3><i class="fas fa-sitemap"></i> Group Structure</h3>
          <button type="button" class="btn-collapse-all" title="Collapse All">
            <i class="fas fa-arrow-right-to-bracket"></i>
          </button>
        </div>
        
        <div class="tree-content">
          ${this._generateTreeNodes(groupMembers, nestedData)}
        </div>
        
        <div class="tree-actions">
          <button type="button" class="btn-expand-all" title="Expand All">
            <i class="fas fa-expand-arrows-alt"></i> Expand All
          </button>
        </div>
      </div>
    `;
  }


  _generateTreeNodes(nodes, nestedData) {
    let html = '';
    if (!nodes) return html;

    for (const node of nodes) {
      const children = this._getChildrenForMember(node, nestedData);
      const hasChildren = children && children.length > 0;

      html += `
        <div class="tree-node" data-type="${node.type}" data-uuid="${node.uuid}">
          <div class="tree-node-header ${hasChildren ? 'expandable' : ''}" data-uuid="${node.uuid}">
            ${hasChildren ? '<i class="fas fa-chevron-right expand-icon"></i>' : '<i class="tree-spacer"></i>'}
            <i class="${TemplateComponents.getAsset('icon', node.type)} node-icon" alt="${node.name}">&nbsp;</i><span class="tree-label"> ${node.name}</span>
            
            <div class="tree-actions">
              <button type="button" class="btn-open-sheet" data-uuid="${node.uuid}" title="Open Sheet">
                <i class="fas fa-external-link-alt"></i>
              </button>
              <button type="button" class="btn-remove-member" data-uuid="${node.uuid}" title="Remove from Group">
                <i class="fas fa-times"></i>
              </button>
            </div><span class="tree-type">${node.type}</span>
          </div>
          
          ${hasChildren ? `
            <div class="tree-children" style="display: none;">
              ${this._generateTreeNodes(children, nestedData)}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    return html;
  }

  // _generateTreeNodes(groupMembers, nestedData) {
  //   let html = '';
    
  //   for (const member of groupMembers) {
  //     const type = member.type;
  //     const children = this._getChildrenForMember(member, nestedData);
  //     const hasChildren = children.length > 0;


  //     html += `
  //       <div class="tree-node" data-type="${type}" data-uuid="${member.uuid}">
  //         <div class="tree-node-header ${hasChildren ? 'expandable' : ''}" data-uuid="${member.uuid}">
  //           ${hasChildren ? '<i class="fas fa-chevron-right expand-icon"></i>' : '<i class="tree-spacer"></i>'}
  //           <img src="${TemplateComponents.getAsset('image',member.type,member.img )}" class="tree-icon" alt="${member.name}">
  //           <span class="tree-label">${member.name}</span>
  //           <span class="tree-type">${type}</span>
  //           <div class="tree-actions">
  //             <button type="button" class="btn-open-sheet" data-uuid="${member.uuid}" title="Open Sheet">
  //               <i class="fas fa-external-link-alt"></i>
  //             </button>
  //             <button type="button" class="btn-remove-member" data-uuid="${member.uuid}" title="Remove from Group">
  //               <i class="fas fa-times"></i>
  //             </button>
  //           </div>
  //         </div>
          
  //         ${hasChildren ? `
  //           <div class="tree-children" style="display: none;">
  //             ${this._generateChildrenNodes(children, member)}
  //           </div>
  //         ` : ''}
  //       </div>
  //     `;
  //   }
    
  //   return html;
  // }

  // _generateChildrenNodes(children, parent) {
  //   let html = '';
    
  //   // Group children by type
  //   const childrenByType = children.reduce((acc, child) => {
  //     if (!acc[child.type]) acc[child.type] = [];
  //     acc[child.type].push(child);
  //     return acc;
  //   }, {});
    
  //   // Generate nodes for each type
  //   for (const [childType, items] of Object.entries(childrenByType)) {
  //     html += `
  //       <div class="tree-child-group">
  //         <div class="tree-child-header">
  //           <i class="fas fa-${TemplateComponents.getAsset('icon', childType)}"></i>
  //           <span class="child-type-label">${childType.toUpperCase()}S (${items.length})</span>
  //         </div>
  //         <div class="tree-child-items">
  //           ${items.map(item => `
  //             <div class="tree-child-item" data-uuid="${item.uuid}" data-parent="${parent.uuid}">
  //               <img src="${TemplateComponents.getAsset('image', item.type, item.img)}" class="child-icon" alt="${item.name}">
  //               <span class="child-label">${item.name}</span>
  //               <div class="child-actions">
  //                 <button type="button" class="btn-open-sheet" data-uuid="${item.uuid}" title="Open Sheet">
  //                   <i class="fas fa-external-link-alt"></i>
  //                 </button>
  //                 <button type="button" class="btn-focus-item" data-uuid="${item.uuid}" title="Focus in Tab">
  //                   <i class="fas fa-search"></i>
  //                 </button>
  //               </div>
  //             </div>
  //           `).join('')}
  //         </div>
  //       </div>
  //     `;
  //   }
    
  //   return html;
  // }

  _getChildrenForMember(member, nestedData) {
    const children = [];
    
    switch (member.type) {
      case 'group': // Add this case
      children.push(...(nestedData.membersByGroup[member.uuid] || []));
      break;
      case 'region':
        // Add locations, which will have their own children
        children.push(...(nestedData.locationsByRegion[member.uuid] || []));
        break;
      case 'location':
        // Add shops and NPCs
        children.push(...(nestedData.shopsByLocation[member.uuid] || []));
        children.push(...(nestedData.npcsByLocation[member.uuid] || []));
        break;
        
      case 'shop':
        // Add NPCs and inventory items
        children.push(...(nestedData.npcsByShop[member.uuid] || []));
        children.push(...(nestedData.itemsByShop[member.uuid] || []));
        break;
        
      case 'npc':
        // NPCs don't have visual children in the tree, but their relationships are shown in tabs
        break;
    }
    
    return children;
  }

  _generateInfoTab(data) {
    const stats = this._calculateGroupStats(data.nestedData);
    
    return `
      
      <div class="group-stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="${TemplateComponents.getAsset('icon', 'region')}"></i></div>
          <div class="stat-content">
            <div class="stat-number">${stats.regions}</div>
           </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon"><i class="${TemplateComponents.getAsset('icon', 'location')}"></i></div>
          <div class="stat-content">
            <div class="stat-number">${stats.locations}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon"><i class="${TemplateComponents.getAsset('icon', 'shop')}"></i></div>
          <div class="stat-content">
            <div class="stat-number">${stats.shops}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon"><i class="${TemplateComponents.getAsset('icon', 'npc')}"></i></div>
          <div class="stat-content">
            <div class="stat-number">${stats.npcs}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon"><i class="${TemplateComponents.getAsset('icon', 'item')}"></i></div>
          <div class="stat-content">
            <div class="stat-number">${stats.items}</div>
          </div>
        </div>
      </div>
      
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
       <div class="form-section">
             <h3><i class="fas fa-link"></i> Add Members</h3>

        ${TemplateComponents.dropZone('member', 'fas fa-plus-circle', 'Add Members', 'Drag regions, locations, entries, or NPCs here to add them to this group')}
      </div>
    `;
  }

  _generateNPCsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-users', 'All NPCs in Group')}
      
      <div class="npc-filters">
        <button type="button" class="filter-btn active" data-filter="all">All NPCs</button>
        <button type="button" class="filter-btn" data-filter="location">Location NPCs</button>
        <button type="button" class="filter-btn" data-filter="shop">Entry NPCs</button>
        <button type="button" class="filter-btn" data-filter="player">Player Characters</button>
      </div>
      
      <div class="npc-grid-container">
        ${this._generateNPCCards(data.nestedData.allNPCs)}
      </div>
    `;
  }

  _generateInventoryTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-boxes', 'All Inventory in Group')}
      
      <div class="inventory-summary">
        <div class="summary-stat">
          <span class="stat-value">${data.nestedData.allItems.length}</span>
          <span class="stat-label">Total Items</span>
        </div>
        <div class="summary-stat">
          <span class="stat-value">${data.nestedData.totalValue}</span>
          <span class="stat-label">Total Value</span>
        </div>
      </div>
      
      <div class="inventory-by-shop">
        ${this._generateInventoryByShop(data.nestedData)}
      </div>
    `;
  }

  _generateLocationsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-map-marker-alt', 'All Locations in Group')}
      
      <div class="locations-grid">
        ${this._generateLocationCards(data.nestedData.allLocations)}
      </div>
    `;
  }

  _generateNPCCards(npcs) {
    return npcs.map(npc => `
      <div class="group-npc-card" data-filter="${npc.source}" data-uuid="${npc.uuid}">
        <div class="npc-avatar">
          <img src="${TemplateComponents.getAsset('image', 'npc', npc.img)}" alt="${npc.name}">
        </div>
        <div class="npc-info">
          <h4 class="npc-name">${npc.name}</h4>
          <div class="npc-source">${npc.sourceLocation || npc.sourceShop || 'Direct'}</div>
          ${npc.actor ? `<div class="npc-stats">AC ${npc.actor.ac} | HP ${npc.actor.hp.value}/${npc.actor.hp.max}</div>` : ''}
        </div>
        <div class="npc-actions">
          <button type="button" class="btn-open-sheet" data-uuid="${npc.uuid}">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${npc.actor ? `
            <button type="button" class="btn-open-actor" data-uuid="${npc.actor.uuid}">
              <i class="fas fa-user"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  _generateLocationCards(locations) {
    return locations.map(location => `
      <div class="group-location-card" data-uuid="${location.uuid}">
        <div class="location-image">
          <img src="${TemplateComponents.getAsset('image', location.type, location.img)}" alt="${location.name}">
        </div>
        <div class="location-info">
          <h4 class="location-name">${location.name}</h4>
          <div class="location-stats">
            ${location.npcCount} NPCs | ${location.shopCount} Shops
          </div>
          ${location.region ? `<div class="location-region">Region: ${location.region}</div>` : ''}
        </div>
        <div class="location-actions">
          <button type="button" class="btn-open-sheet" data-uuid="${location.uuid}">
            <i class="fas fa-external-link-alt"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  _generateInventoryByShop(nestedData) {
    let html = '';
    
    for (const [shopUuid, items] of Object.entries(nestedData.itemsByShop)) {
      const shop = nestedData.allShops.find(s => s.uuid === shopUuid);
      if (!shop || items.length === 0) continue;
      const totalValue = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
      
      html += `
        <div class="shop-inventory-section">
          <div class="shop-header">
            <img src="${TemplateComponents.getAsset('image', shop.type, shop.img)}" alt="${shop.name}" class="shop-icon">
            <div class="shop-info">
              <h4 class="shop-name">${shop.name}</h4>
              <div class="shop-stats">${items.length} items | ${totalValue}gp total</div>
            </div>
            <button type="button" class="btn-open-sheet" data-uuid="${shopUuid}">
              <i class="fas fa-external-link-alt"></i>
            </button>
          </div>
          
          <div class="shop-items">
            ${items.map(item => `
              <div class="group-item-card">
                <img src="${TemplateComponents.getAsset('image', 'item',item.img)}" alt="${item.name}" class="item-icon">
                <div class="item-info">
                  <span class="item-name">${item.name}</span>
                  <span class="item-price">${item.quantity}x ${item.finalPrice}${item.currency}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    return html;
  }



  _calculateGroupStats(nestedData) {
    return {
      regions: nestedData.allRegions.length,
      locations: nestedData.allLocations.length,
      shops: nestedData.allShops.length,
      npcs: nestedData.allNPCs.length,
      items: nestedData.allItems.length
    };
  }



  // async _addMemberToGroup(memberUuid) {
  //   await this._saveFormData();
    
  //   const groupData = this.document.getFlag("campaign-codex", "data") || {};
  //   const members = groupData.members || [];
    
  //   if (!members.includes(memberUuid)) {
  //     members.push(memberUuid);
  //     groupData.members = members;
  //     await this.document.setFlag("campaign-codex", "data", groupData);
  //     this.render(false);
  //     ui.notifications.info("Added member to group");
  //   }
  // }

// async _addMemberToGroup(newMemberUuid) {
//   const groupData = this.document.getFlag("campaign-codex", "data") || {};
//   const currentMembers = groupData.members || [];
  
//   // 1. Get all entities currently in the group, including all nested children.
//   const existingMembers = await GroupLinkers.getGroupMembers(currentMembers);
//   const nestedData = await GroupLinkers.getNestedData(existingMembers);
  
//   const allUuids = new Set([
//     ...nestedData.allGroups.map(i => i.uuid),
//     ...nestedData.allRegions.map(i => i.uuid),
//     ...nestedData.allLocations.map(i => i.uuid),
//     ...nestedData.allShops.map(i => i.uuid),
//     ...nestedData.allNPCs.map(i => i.uuid),
//     ...nestedData.allItems.map(i => i.uuid)
//   ]);

//   // 2. Check if the new member already exists anywhere in the hierarchy.
//   if (allUuids.has(newMemberUuid)) {
//     const doc = await fromUuid(newMemberUuid);
//     ui.notifications.warn(`"${doc.name}" is already included in this group as a child of another member.`);
//     return;
//   }

//   // 3. If it's not a duplicate, add it.
//   currentMembers.push(newMemberUuid);
//   groupData.members = currentMembers;
//   await this.document.setFlag("campaign-codex", "data", groupData);
  
//   this.render(false);
//   ui.notifications.info("Added member to group.");
// }
// In group-sheet.js

async _addMemberToGroup(newMemberUuid) {
  // 1. Check for direct self-addition
  if (newMemberUuid === this.document.uuid) {
    ui.notifications.warn("A group cannot be added to itself.");
    return;
  }

  // 2. Check for indirect/circular dependencies
  const newMemberDoc = await fromUuid(newMemberUuid);
  if (newMemberDoc && newMemberDoc.getFlag("campaign-codex", "type") === 'group') {
    const membersOfNewGroup = await GroupLinkers.getGroupMembers(newMemberDoc.getFlag("campaign-codex", "data")?.members || []);
    const nestedDataOfNewGroup = await GroupLinkers.getNestedData(membersOfNewGroup);
    
    // Check if the current group is already a child of the one being added
    if (nestedDataOfNewGroup.allGroups.some(g => g.uuid === this.document.uuid)) {
      ui.notifications.warn(`Cannot add "${newMemberDoc.name}" as it would create a circular dependency.`);
      return;
    }
  }

  // 3. Check if the member already exists as a child of another member
  const groupData = this.document.getFlag("campaign-codex", "data") || {};
  const currentMembers = groupData.members || [];
  const existingMembers = await GroupLinkers.getGroupMembers(currentMembers);
  const nestedData = await GroupLinkers.getNestedData(existingMembers);
  
  const allUuids = new Set(nestedData.allGroups.map(i => i.uuid).concat(nestedData.allRegions.map(i => i.uuid), nestedData.allLocations.map(i => i.uuid), nestedData.allShops.map(i => i.uuid), nestedData.allNPCs.map(i => i.uuid)));

  if (allUuids.has(newMemberUuid)) {
    ui.notifications.warn(`"${newMemberDoc.name}" is already included in this group as a child of another member.`);
    return;
  }

  // If all checks pass, add the member
  currentMembers.push(newMemberUuid);
  groupData.members = currentMembers;
  await this.document.setFlag("campaign-codex", "data", groupData);
  
  this.render(false);
  ui.notifications.info(`Added "${newMemberDoc.name}" to the group.`);
}




  async _onRemoveMember(event) {
    const memberUuid = event.currentTarget.dataset.uuid;
    await this._saveFormData();
    
    const groupData = this.document.getFlag("campaign-codex", "data") || {};
    groupData.members = (groupData.members || []).filter(uuid => uuid !== memberUuid);
    await this.document.setFlag("campaign-codex", "data", groupData);
    
    this.render(false);
    ui.notifications.info("Removed member from group");
  }

  _onToggleTreeNode(event) {
    const header = event.currentTarget;
    const children = header.parentElement.querySelector('.tree-children');
    const icon = header.querySelector('.expand-icon');
    
    if (children.style.display === 'none') {
      children.style.display = 'block';
      icon.classList.remove('fa-chevron-right');
      icon.classList.add('fa-chevron-down');
    } else {
      children.style.display = 'none';
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-right');
    }
  }

  _onExpandAll(event) {
    this.element.find('.tree-children').show();
    this.element.find('.expand-icon').removeClass('fa-chevron-right').addClass('fa-chevron-down');
  }

  _onCollapseAll(event) {
    this.element.find('.tree-children').hide();
    this.element.find('.expand-icon').removeClass('fa-chevron-down').addClass('fa-chevron-right');
  }

  async _onOpenSheet(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const doc = await fromUuid(uuid);
    if (doc) {
      doc.sheet.render(true);
    }
  }

  async _onOpenActor(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const actor = await fromUuid(uuid);
    if (actor) {
      actor.sheet.render(true);
    }
  }

  _onFocusItem(event) {
    const uuid = event.currentTarget.dataset.uuid;
    // Switch to appropriate tab and highlight the item
    // Implementation depends on the tab content
  }

  _onFilterChange(event) {
    const filter = event.currentTarget.dataset.filter;
    const cards = this.element.find('.group-npc-card');
    
    // Update active filter button
    this.element.find('.filter-btn').removeClass('active');
    event.currentTarget.classList.add('active');
    
    // Show/hide cards based on filter
    cards.each(function() {
      const cardFilter = this.dataset.filter;
      if (filter === 'all' || cardFilter === filter) {
        this.style.display = 'block';
      } else {
        this.style.display = 'none';
      }
    });
  }

  _onTabChange(event) {
    event.preventDefault();
    const tab = event.currentTarget.dataset.tab;
    this._currentTab = tab;
    this._showGroupTab(tab);
  }

  _showGroupTab(tabName) {
    const $html = this.element;
    
    $html.find('.group-tab').removeClass('active');
    $html.find('.group-tab-panel').removeClass('active');

    $html.find(`.group-tab[data-tab="${tabName}"]`).addClass('active');
    $html.find(`.group-tab-panel[data-tab="${tabName}"]`).addClass('active');
  }

  // Override close to save on close (copied from base sheet)
  async close(options = {}) {
    // Check if we're being force-closed due to document deletion
    if (this._forceClose) {
      return super.close(options);
    }

    // Check if document still exists before trying to save
    const documentExists = this.document && game.journal.get(this.document.id);
    
    if (documentExists && !this.document._pendingDeletion) {
        await this._saveFormData();
    }
    
    return super.close(options);
  }

  getSheetType() {
    return "group";
  }


}