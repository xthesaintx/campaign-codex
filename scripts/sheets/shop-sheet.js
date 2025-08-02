import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class ShopSheet extends CampaignCodexBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, "shop-sheet"]
    });
  }

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  async getData() {
    const data = await super.getData();
    const shopData = this.document.getFlag("campaign-codex", "data") || {};
    data.isLoot = shopData.isLoot || false;
    data.hideInventory = shopData.hideInventory || false;



  data.linkedScene = null;
  if (shopData.linkedScene) {
    try {
      const scene = await fromUuid(shopData.linkedScene);
      if (scene) {
        data.linkedScene = {
          uuid: scene.uuid,
          name: scene.name,
          img: scene.thumb || "icons/svg/map.svg"
        };
      }
    } catch (error) {
      console.warn(`Campaign Codex | Linked scene not found: ${shopData.linkedScene}`);
    }
  }



    // Get linked documents
    data.linkedNPCs = await CampaignCodexLinkers.getLinkedNPCs(shopData.linkedNPCs || []);
    data.linkedNPCs = await CampaignCodexLinkers.getLinkedNPCs(this.document, shopData.linkedNPCs || []);
    data.linkedLocation = shopData.linkedLocation ? await CampaignCodexLinkers.getLinkedLocation(shopData.linkedLocation) : null;
    data.inventory = await CampaignCodexLinkers.getInventory(this.document, shopData.inventory || []);
    
    // Sheet configuration
    data.sheetType = "shop";
    data.sheetTypeLabel = "Entry";
    data.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image','shop');
    data.markup = shopData.markup || 1.0;
    
    // Navigation tabs
    data.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      ...(data.hideInventory ? [] : [{ key: 'inventory', label: 'Inventory', icon: 'fas fa-boxes', active: this._currentTab === 'inventory',
      statistic: {
        value: data.inventory.length,
        color: '#28a745'
      } }]),
      { key: 'npcs', label: 'NPCs', icon: 'fas fa-users', active: this._currentTab === 'npcs',
      statistic: {
        value: data.linkedNPCs.length,
        color: '#fd7e14'
      } },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    // Statistics
    data.statistics = [
      { icon: 'fas fa-boxes', value: data.inventory.length, label: 'ITEMS', color: '#28a745' },
      { icon: 'fas fa-users', value: data.linkedNPCs.length, label: 'NPCS', color: '#fd7e14' },
      { icon: 'fas fa-percentage', value: `${data.markup}x`, label: 'MARKUP', color: '#d4af37' }
    ];
    
      const sources = [
    { data: data.linkedLocation, type: 'location' },
    { data: data.linkedNPCs, type: 'npc' }
  ];

  // Generate the de-duplicated quick links
  data.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);


    
    let headerContent = '';
    
    if (data.linkedLocation) {
      headerContent += `
        <div class="region-info">
          <span class="region-label">Located:</span>
          <span class="region-name region-link" data-region-uuid="${data.linkedLocation.uuid}" style="cursor: pointer; color: var(--cc-accent);">${data.linkedLocation.name}</span>
        </div>
      `;
    }
    

  if (data.linkedScene) {
    headerContent += `
      <div class="scene-info">
        
        <span class="scene-name open-scene" data-scene-uuid="${data.linkedScene.uuid}" title="Open Scene"> <i class="fas fa-map"></i> ${data.linkedScene.name}</span>

        <button type="button" class="scene-btn remove-scene" title="Unlink Scene">
          <i class="fas fa-unlink"></i>
        </button>
      </div>
    `;
  }
  else
  {   headerContent += `<div class="scene-info">
        
        <span class="scene-name open-scene" style="text-align:center;"><i class="fas fa-link"></i> Drop scene to link</span>

      </div>
    `;}

    // Add toggle controls
    headerContent += `
      <div class="shop-toggles" style="margin-top: 8px; display: flex; gap: 12px; align-items: center; justify-content: center;">
      <span class="stat-label">Hide Inventory</span>
        <label class="toggle-control">
          <input type="checkbox" class="hide-inventory-toggle" ${data.hideInventory ? 'checked' : ''} style="margin: 0;"><span class="slider"></span>
        </label>
      </div>
    `;
    
    data.customHeaderContent = headerContent;
  
    
    // Tab panels
    data.tabPanels = [
      {
        key: 'info',
        active: this._currentTab === 'info',
        content: this._generateInfoTab(data)
      },
      ...(data.hideInventory ? [] : [{
        key: 'inventory', 
        active: this._currentTab === 'inventory',
        content: this._generateInventoryTab(data)
      }]),
      {
        key: 'npcs', 
        active: this._currentTab === 'npcs',
        content: this._generateNPCsTab(data)
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
    
    if (data.linkedLocation) {
      locationSection = `
        <div class="form-section">
          <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
          <div class="linked-actor-card">
            <div class="actor-image">
              <img src="${data.linkedLocation.img}" alt="${data.linkedLocation.name}">
            </div>
            <div class="actor-content">
              <h4 class="actor-name">${data.linkedLocation.name}</h4>
              <div class="actor-details">
                <span class="actor-race-class">Location</span>
              </div>
            </div>
            <div class="actor-actions">
              <button type="button" class="action-btn open-location" data-location-uuid="${data.linkedLocation.uuid}" title="Open Location">
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
          ${TemplateComponents.dropZone('location', 'fas fa-map-marker-alt', 'Set Location', 'Drag a location journal here to set where this entry is located')}
        </div>
      `;
    }
    
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information')}
      ${locationSection}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }

  _generateInventoryTab(data) {
  const markupSection = data.isLoot ? '' : TemplateComponents.markupControl(data.markup);
  
  return `
    ${TemplateComponents.contentHeader('fas fa-boxes', data.isLoot ? 'Loot' : 'Inventory')}
    <div class="shop-toggles">
      <span class="stat-label">Loot Mode</span>
      <label class="toggle-control">
        <input type="checkbox" class="shop-loot-toggle" ${data.isLoot ? 'checked' : ''} style="margin: 0;"><span class="slider"></span>
      </label></div>
    ${TemplateComponents.dropZone('item', 'fas fa-plus-circle', 'Add Items', 'Drag items from the items directory to add them to inventory')}
    ${markupSection}
    ${TemplateComponents.inventoryTable(data.inventory, data.isLoot)}
  `;
}







_generateNPCsTab(data) {
  const dropToMapBtn = canvas.scene ? `
    <button type="button" class="refresh-btn npcs-to-map-button" title="Drop NPCs to current scene">
      <i class="fas fa-map"></i>
      Drop to Map
    </button>
  ` : '';

  return `
    ${TemplateComponents.contentHeader('fas fa-users', 'NPCs', dropToMapBtn)}
    ${TemplateComponents.dropZone('npc', 'fas fa-user-plus', 'Add NPCs', 'Drag NPCs or actors here to associate them with this location')}
    ${TemplateComponents.entityGrid(data.linkedNPCs, 'npc', true)}
  `;
}


// Add these methods to the ShopSheet class in scripts/sheets/shop-sheet.js
  _activateSheetSpecificListeners(html) {
    // Markup input
    html.find('.markup-input').change(this._onMarkupChange.bind(this));
    html.find('.shop-loot-toggle').change(this._onLootToggle.bind(this));
    html.find('.hide-inventory-toggle').change(this._onHideInventoryToggle.bind(this));

    // Remove buttons
    html.find('.remove-npc').click(async (e) => await this._onRemoveFromList(e, 'linkedNPCs'));
    html.find('.remove-item').click(this._onRemoveItem.bind(this));
    html.find('.remove-location').click(this._onRemoveLocation.bind(this));

    // Quantity controls
    html.find('.quantity-decrease').click(this._onQuantityDecrease.bind(this));
    html.find('.quantity-increase').click(this._onQuantityIncrease.bind(this));
    html.find('.quantity-input').change(this._onQuantityChange.bind(this));

    // Price controls
    html.find('.price-input').change(this._onPriceChange.bind(this));

    // Open buttons
    html.find('.open-npc').click(async (e) => await this._onOpenDocument(e, 'npc'));
    html.find('.open-location').click(async (e) => await this._onOpenDocument(e, 'location'));
    html.find('.open-item').click(this._onOpenItem.bind(this)); 
    html.find('.open-actor').click(async (e) => await this._onOpenDocument(e, 'actor'));
    
    // Player transfer buttons
    html.find('.send-to-player').click(this._onSendToPlayer.bind(this));
    
    // Quick links
    html.find('.location-link').click(async (e) => await this._onOpenDocument(e, 'location'));
    html.find('.npc-link').click(async (e) => await this._onOpenDocument(e, 'npc'));

    // Item dragging
    html.find('.inventory-item').on('dragstart', this._onItemDragStart.bind(this));
    html.find('.inventory-item').on('dragend', this._onItemDragEnd.bind(this));

    // Scenes
    html.find('.open-scene').click(this._onOpenScene.bind(this));
    html.find('.remove-scene').click(this._onRemoveScene.bind(this));

  }
async _onOpenScene(event) {
  event.preventDefault();
  const sceneUuid = event.currentTarget.dataset.sceneUuid;
  const scene = await fromUuid(sceneUuid);
  if (scene) {
    scene.view();
  }
}

async _onRemoveScene(event) {
  event.preventDefault();
  await this._saveFormData();
  const currentData = this.document.getFlag("campaign-codex", "data") || {};
  currentData.linkedScene = null;
  await this.document.setFlag("campaign-codex", "data", currentData);
  this.render(false);
  ui.notifications.info("Unlinked scene");
}

  async _handleDrop(data, event) {
      if (data.type === "Scene") {
    await this._handleSceneDrop(data, event);
  } else if (data.type === "Item") {
      await this._handleItemDrop(data, event);
    } else if (data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
    } else if (data.type === "Actor") {
      await this._handleActorDrop(data, event);
    }
  }


async _handleSceneDrop(data, event) {
  const scene = await fromUuid(data.uuid);
  if (!scene) {
    ui.notifications.warn("Could not find the dropped scene.");
    return;
  }
  
  await this._saveFormData();
  await game.campaignCodex.linkSceneToDocument(scene, this.document);
  ui.notifications.info(`Linked scene "${scene.name}" to ${this.document.name}`);
  this.render(false);
}



async _onLootToggle(event) {
  const isLoot = event.target.checked;
  const currentData = this.document.getFlag("campaign-codex", "data") || {};
  currentData.isLoot = isLoot;
  await this.document.setFlag("campaign-codex", "data", currentData);
  this.render(false);
  ui.notifications.info(`${isLoot ? 'Enabled' : 'Disabled'} loot mode`);
}

async _onHideInventoryToggle(event) {
  const hideInventory = event.target.checked;
  const currentData = this.document.getFlag("campaign-codex", "data") || {};
  currentData.hideInventory = hideInventory;
  await this.document.setFlag("campaign-codex", "data", currentData);
  
  // If we're currently on the inventory tab and it's being hidden, switch to info tab
  if (hideInventory && this._currentTab === 'inventory') {
    this._currentTab = 'info';
  }
  
  this.render(false);
  ui.notifications.info(`${hideInventory ? 'Hidden' : 'Shown'} inventory in sidebar`);
}


async _handleItemDrop(data, event) {
  if (!data.uuid) {
    ui.notifications.warn("Could not find item to add to entry");
    return;
  }

  const item = await fromUuid(data.uuid);
  if (!item) {
    ui.notifications.warn("Could not find item to add to entry");
    return;
  }

  // Check if item already exists in inventory
  const currentData = this.document.getFlag("campaign-codex", "data") || {};
  const inventory = currentData.inventory || [];
  
  if (inventory.find(i => i.itemUuid === item.uuid)) {
    ui.notifications.warn("Item already exists in inventory!");
    return;
  }

  await game.campaignCodex.addItemToShop(this.document, item, 1);
  this.render(false);
  ui.notifications.info(`Added "${item.name}" to entry inventory`);
}


  async _handleJournalDrop(data, event) {
    const journal = await fromUuid(data.uuid);
    if (!journal || journal.id === this.document.id) return;

    const journalType = journal.getFlag("campaign-codex", "type");
    
    if (journalType === "npc") {
            await this._saveFormData();
      await game.campaignCodex.linkShopToNPC(this.document, journal);
      this.render(false);
    } else if (journalType === "location") {
        await this._saveFormData();
      await game.campaignCodex.linkLocationToShop(journal, this.document);
      this.render(false);
    }
  }


  async _onMarkupChange(event) {
    const markup = parseFloat(event.target.value) || 1.0;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.markup = markup;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
  }

  async _onQuantityChange(event) {
    const quantity = parseInt(event.target.value) || 1;
    const itemUuid = event.currentTarget.dataset.itemUuid;
    await this._updateInventoryItem(itemUuid, { quantity });
  }

  async _onQuantityDecrease(event) {
    const itemUuid = event.currentTarget.dataset.itemUuid;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
const item = inventory.find(i => i.itemUuid === itemUuid); // Change from itemId to itemUuid
    
    if (item && item.quantity > 0) {
      await this._updateInventoryItem(itemUuid, { quantity: item.quantity - 1 });
    }
  }

  async _onQuantityIncrease(event) {
    const itemUuid = event.currentTarget.dataset.itemUuid;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
    const item = inventory.find(i => i.itemUuid === itemUuid);
    
    if (item) {
      await this._updateInventoryItem(itemUuid, { quantity: item.quantity + 1 });
    }
  }

  async _onPriceChange(event) {
    const price = parseFloat(event.target.value) || null;
    const itemUuid = event.currentTarget.dataset.itemUuid;
    await this._updateInventoryItem(itemUuid, { customPrice: price });
  }

  async _updateInventoryItem(itemUuid, updates) {
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
    const itemIndex = inventory.findIndex(i => i.itemUuid === itemUuid); // Change from itemId to itemUuid
    
    if (itemIndex !== -1) {
      inventory[itemIndex] = { ...inventory[itemIndex], ...updates };
      currentData.inventory = inventory;
      await this.document.setFlag("campaign-codex", "data", currentData);
      this.render(false);
    }
  }

  async _onRemoveItem(event) {
    const itemUuid = event.currentTarget.dataset.itemUuid;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    
currentData.inventory = (currentData.inventory || []).filter(i => i.itemUuid !== itemUuid); // Change from itemId to itemUuid
    await this.document.setFlag("campaign-codex", "data", currentData);
    
    this.render(false);
  }

async _onRemoveLocation(event) {
  // 1. Get the current shop and its linked location's UUID
  const shopDoc = this.document;
  const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
  const locationUuid = shopData.linkedLocation;

  if (!locationUuid) return; // Nothing to do if no location is linked

  try {
    // 2. Find the Location document
    const locationDoc = await fromUuid(locationUuid);
    if (locationDoc) {
      // 3. Remove this shop's UUID from the Location's flags
      const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
      if (locationData.linkedShops) {
        locationData.linkedShops = locationData.linkedShops.filter(uuid => uuid !== shopDoc.uuid);
        
        // Update the location document and tell it to skip the faulty hook
        locationDoc._skipRelationshipUpdates = true;
        await locationDoc.setFlag("campaign-codex", "data", locationData);
        delete locationDoc._skipRelationshipUpdates;

        // Manually refresh the Location sheet if it's open
        for (const app of Object.values(ui.windows)) {
          if (app.document?.uuid === locationDoc.uuid) {
            app.render(false);
          }
        }
      }
    }

    // 4. Now, remove the location link from this shop itself
    shopDoc._skipRelationshipUpdates = true;
    await shopDoc.update({ "flags.campaign-codex.data.linkedLocation": null });
    delete shopDoc._skipRelationshipUpdates;

  } catch (error) {
    console.error("Campaign Codex | Error removing location link:", error);
    ui.notifications.error("Failed to remove location link.");
  } finally {
    // 5. Refresh the current (Shop) sheet to show the change
    this.render(false);
  }
}


  getSheetType() {
    return "shop";
  }


// New method to handle opening item sheets
async _onOpenItem(event) {
  event.stopPropagation();
  const itemUuid = event.currentTarget.dataset.itemUuid;
  const item = await fromUuid(itemUuid) || game.items.get(itemUuid);
  
  if (item) {
    item.sheet.render(true);
  } else {
    ui.notifications.warn("Item not found in world items");
  }
}

// New method to handle sending items to players
async _onSendToPlayer(event) {
  event.stopPropagation();
  const itemUuid = event.currentTarget.dataset.itemUuid;
  const item = await fromUuid(itemUuid) || game.items.get(itemUuid);
  
  if (!item) {
    ui.notifications.warn("Item not found");
    return;
  }


  TemplateComponents.createPlayerSelectionDialog(item.name, async (targetActor) => {
    await this._transferItemToActor(item, targetActor);
  });
}

// Method to transfer item to actor
async _transferItemToActor(item, targetActor) {
  try {
    // Create a copy of the item data
    const itemData = item.toObject();
    delete itemData._id; // Remove ID to create a new item
    
    // Get the quantity from the shop inventory
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
const shopItem = inventory.find(i => i.itemUuid === item.uuid); // Change from itemId to item.id, use item.uuid
    const quantity = shopItem ? shopItem.quantity : 1;
    
    // Set the quantity
    itemData.system.quantity = Math.min(quantity, 1); // Transfer 1 item at a time
    
    // Add item to target actor
    await targetActor.createEmbeddedDocuments("Item", [itemData]);
    
    // Reduce quantity in shop by 1
    if (shopItem && shopItem.quantity > 1) {
await this._updateInventoryItem(item.uuid, { quantity: shopItem.quantity - 1 }); // Change from item.id to item.uuid
    } else {
      // Remove item from shop if quantity is 1 or less
await this._onRemoveItem({ currentTarget: { dataset: { itemUuid: item.uuid } } }); // Change from item.id to item.uuid
    }
    
    ui.notifications.info(`Sent "${item.name}" to ${targetActor.name}`);
    
    // Notify the player if they're online
    const targetUser = game.users.find(u => u.character?.id === targetActor.id);
    if (targetUser && targetUser.active) {
      ChatMessage.create({
        content: `<p><strong>${game.user.name}</strong> sent you <strong>${item.name}</strong> from ${this.document.name}!</p>`,
        whisper: [targetUser.id]
      });
    }
    
  } catch (error) {
    console.error("Error transferring item:", error);
    ui.notifications.error("Failed to transfer item");
  }
}

_onItemDragStart(event) {
  const itemUuid = event.currentTarget.dataset.itemUuid;
  
  const dragData = {
    type: "Item",
    uuid: itemUuid,
    source: "shop",
    shopId: this.document.id
  };
  
  event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  
  // Set visual feedback
  event.currentTarget.style.opacity = "0.5";
}

_onItemDragEnd(event) {
  // Reset the visual feedback
  event.currentTarget.style.opacity = "1";
}

// ADD this method to handle the drop to map button click:
async _onDropNPCsToMapClick(event) {
  event.preventDefault();
  
  // Get current data to access linked NPCs
  const shopData = this.document.getFlag("campaign-codex", "data") || {};
  const linkedNPCs = await CampaignCodexLinkers.getLinkedNPCs(this.document,shopData.linkedNPCs || []);
  
  if (linkedNPCs && linkedNPCs.length > 0) {
    await this._onDropNPCsToMap(linkedNPCs, { 
      title: `Drop ${this.document.name} NPCs to Map` 
    });
  } else {
    ui.notifications.warn("No NPCs with linked actors found to drop!");
  }
}

}