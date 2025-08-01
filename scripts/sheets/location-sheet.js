import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class LocationSheet extends CampaignCodexBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, "location-sheet"]
    });
  }

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  async getData() {
    const data = await super.getData();
    const locationData = this.document.getFlag("campaign-codex", "data") || {};

   
    // Get linked documents - split direct and auto-populated NPCs
    data.directNPCs = await CampaignCodexLinkers.getDirectNPCs(this.document,locationData.linkedNPCs || []);
    data.shopNPCs = await CampaignCodexLinkers.getShopNPCs(this.document,locationData.linkedShops || []);
    data.allNPCs = [...data.directNPCs, ...data.shopNPCs];
    data.linkedShops = await CampaignCodexLinkers.getLinkedShops(this.document, locationData.linkedShops || []);
    data.linkedRegion = await CampaignCodexLinkers.getLinkedRegion(this.document);
    
    // Sheet configuration
    data.sheetType = "location";
    data.sheetTypeLabel = "Location";
    data.customImage = this.document.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";
    
    // Navigation tabs
    data.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'npcs', label: 'NPCs', icon: 'fas fa-users', active: this._currentTab === 'npcs', statistic: {value: data.allNPCs.length,color: '#fd7e14'} },
      { key: 'shops', label: 'Entries', icon: 'fas fa-book-open', active: this._currentTab === 'shops', statistic: {value: data.linkedShops.length, color: '#6f42c1'} },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    // Statistics - use total NPC count
    data.statistics = [
      { icon: 'fas fa-users', value: data.allNPCs.length, label: 'NPCS', color: '#fd7e14' },
      { icon: 'fas fa-book-open', value: data.linkedShops.length, label: 'ENTRIES', color: '#6f42c1' }
    ];
    
    // Quick links - use all NPCs
    // data.quickLinks = [
    //   ...data.allNPCs.map(npc => ({ ...npc, type: 'npc' })),
    //   ...data.linkedShops.map(shop => ({ ...shop, type: 'shop' }))
    // ];

  const sources = [
    { data: data.allNPCs, type: 'location' },
    { data: data.linkedShops, type: 'shop' },
    // { data: data.associates, type: 'npc' }
  ];

  // Generate the de-duplicated quick links
  data.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);



    const allItems = [
      ...data.allNPCs.map(npc => ({ ...npc, type: 'npc' })),
      ...data.linkedShops.map(shop => ({ ...shop, type: 'shop' }))
    ];


    
    // Custom header content (region info)
    if (data.linkedRegion) {
      data.customHeaderContent = `
        <div class="region-info">
          <span class="region-label">Region:</span>
          <span class="region-name region-link" data-region-uuid="${data.linkedRegion.uuid}" style="cursor: pointer; color: var(--cc-accent);">${data.linkedRegion.name}</span>
        </div>
      `;
    }
    
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
        key: 'shops', 
        active: this._currentTab === 'shops',
        content: this._generateShopsTab(data)
      },
      {
        key: 'notes',
        active: this._currentTab === 'notes',
        content: CampaignCodexBaseSheet.generateNotesTab(data)
      }
    ];
    
    return data;
  }



  _generateInfoTab(data) {
    let locationSection = '';
    
    if (data.linkedRegion) {
      locationSection = `
        <div class="form-section">
          <h3><i class="${TemplateComponents.getAsset('icon','region')}"></i> Region</h3>
          <div class="linked-actor-card">
            <div class="actor-image">
              <img src="${data.linkedRegion.img}" alt="${data.linkedRegion.name}">
            </div>
            <div class="actor-content">
              <h4 class="actor-name">${data.linkedRegion.name}</h4>
            </div>
            <div class="actor-actions">
              <button type="button" class="action-btn open-location" data-location-uuid="${data.linkedRegion.uuid}" title="Open Location">
                <i class="fas fa-external-link-alt"></i>
              </button>
              <button type="button" class="action-btn remove-location" title="Remove Location">
                <i class="fas fa-unlink"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      locationSection = `
      <div class="form-section">
        ${TemplateComponents.dropZone('region', 'fas fa-globe', 'Set Region', 'Drag a region journal here to add this location to a region')}
      </div>`;
    }
    
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information')}
      ${locationSection}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }



_generateNPCsTab(data) {
  // Only show drop button for direct NPCs (not shop NPCs)
  const dropToMapBtn = (canvas.scene && data.directNPCs && data.directNPCs.length > 0) ? `
    <button type="button" class="refresh-btn npcs-to-map-button" title="Drop direct NPCs to current scene">
      <i class="fas fa-map"></i>
      Drop Direct NPCs
    </button>
  ` : '';

  // Create separate sections for direct NPCs and shop NPCs
  let content = `
    ${TemplateComponents.contentHeader('fas fa-users', 'NPCs at this Location', dropToMapBtn)}
    ${TemplateComponents.dropZone('npc', 'fas fa-user-plus', 'Add NPCs', 'Drag NPCs or actors here to add them directly to this location')}
  `;

  // Direct NPCs section
  if (data.directNPCs.length > 0) {
    content += `
      <div class="npc-section">
        <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
          <i class="fas fa-user" style="color: var(--cc-accent); margin-right: 8px;"></i>
          Direct NPCs (${data.directNPCs.length}) 
         </h3>
        ${TemplateComponents.entityGrid(data.directNPCs, 'npc', true)}
      </div>
    `;
  }

  // Shop NPCs section - no drop button for these
  if (data.shopNPCs.length > 0) {
    content += `
      <div class="npc-section">
        <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
          <i class="fas fa-book-open" style="color: var(--cc-accent); margin-right: 8px;"></i>
          Shop NPCs (${data.shopNPCs.length})
         </h3>
        ${TemplateComponents.infoBanner('NPCs automatically populated from entries at this location. Manage them through their respective shops.')}
        ${TemplateComponents.entityGrid(data.shopNPCs, 'npc', true)}
      </div>
    `;
  }

  // If no NPCs at all
  if (data.allNPCs.length === 0) {
    content += TemplateComponents.emptyState('npc');
  }

  return content;
}

  _generateShopsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-book-open', 'Entries at this Location')}
      ${TemplateComponents.dropZone('shop', 'fas fa-book-open', 'Add Entries', 'Drag entry journals here to add them to this location')}
      ${TemplateComponents.entityGrid(data.linkedShops, 'shop')}
    `;
  }


  _activateSheetSpecificListeners(html) {
    // Remove buttons - only allow removing direct NPCs
    html.find('.remove-npc').click(async (e) => {
      const npcUuid = e.currentTarget.dataset.npcUuid;
      // Check if this is a direct NPC or shop NPC
      const npcCard = e.currentTarget.closest('.entity-card');
      const isShopNPC = npcCard.querySelector('.shop-tags');
      
      if (isShopNPC) {
        ui.notifications.warn("Cannot remove shop NPCs directly. Remove them from their entries instead.");
        return;
      }
      
      await this._onRemoveFromList(e, 'linkedNPCs');
    });
    
    html.find('.remove-location').click(this._onRemoveFromRegion.bind(this));
    html.find('.remove-shop').click(async (e) => await this._onRemoveFromList(e, 'linkedShops'));

    // Open buttons
    html.find('.open-npc').click(async (e) => await this._onOpenDocument(e, 'npc'));
    html.find('.open-shop').click(async (e) => await this._onOpenDocument(e, 'shop'));
    html.find('.open-actor').click(async (e) => await this._onOpenDocument(e, 'actor'));
    html.find('.open-region').click(async (e) => await this._onOpenDocument(e, 'region')); 

    // Quick links
    html.find('.npc-link').click(async (e) => await this._onOpenDocument(e, 'npc'));
    html.find('.shop-link').click(async (e) => await this._onOpenDocument(e, 'shop'));
    
    // Region link
    html.find('.region-link').click(async (e) => await this._onOpenDocument(e, 'region'));

    // Refresh button for auto-populated data
    html.find('.refresh-npcs').click(this._onRefreshNPCs.bind(this));
  }

  async _onRefreshNPCs(event) {
    this.render(false);
    ui.notifications.info("Location data refreshed!");
  }

  async _handleDrop(data, event) {
    if (data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
    } else if (data.type === "Actor") {
      await this._handleActorDrop(data, event);
    }
  }

async _handleJournalDrop(data, event) {
  const journal = await fromUuid(data.uuid);
  if (!journal || journal.uuid === this.document.uuid) return; // Prevent self-linking

  const journalType = journal.getFlag("campaign-codex", "type");
  
  if (journalType === "npc") {
    await this._saveFormData();
    await game.campaignCodex.linkLocationToNPC(this.document, journal);
    this.render(false);
  } else if (journalType === "shop") {
    await this._saveFormData();
    await game.campaignCodex.linkLocationToShop(this.document, journal);
    this.render(false);
  } else if (journalType === "region") {
    // Handle region drop - link this location to the region
    await this._saveFormData();
    await game.campaignCodex.linkRegionToLocation(journal, this.document);
    ui.notifications.info(`Added "${this.document.name}" to region "${journal.name}"`);
    this.render(false);
  }
}


  getSheetType() {
    return "location";
  }



// ADD this method to handle the drop to map button click:
async _onDropNPCsToMapClick(event) {
  event.preventDefault();
  
  // Get current data to access direct NPCs
  const locationData = this.document.getFlag("campaign-codex", "data") || {};
  const directNPCs = await CampaignCodexLinkers.getDirectNPCs(this.document,locationData.linkedNPCs || []);
  
  // Only drop direct NPCs for locations
  if (directNPCs && directNPCs.length > 0) {
    await this._onDropNPCsToMap(directNPCs, { 
      title: `Drop ${this.document.name} Direct NPCs to Map` 
    });
  } else {
    ui.notifications.warn("No direct NPCs with linked actors found to drop!");
  }
}
}