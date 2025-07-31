import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';


export class NPCSheet extends CampaignCodexBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, "npc-sheet"]
    });
  }

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  async getData() {
    const data = await super.getData();
    const npcData = this.document.getFlag("campaign-codex", "data") || {};


    // Get linked documents with complete location discovery
    data.linkedActor = npcData.linkedActor ? await CampaignCodexLinkers.getLinkedActor(npcData.linkedActor) : null;
    data.allLocations = await CampaignCodexLinkers.getAllLocations(this.document, npcData.linkedLocations || []);
    data.linkedShops = await CampaignCodexLinkers.getLinkedShopsWithLocation(this.document,npcData.linkedShops || []);
    data.associates = await CampaignCodexLinkers.getAssociates(this.document,npcData.associates || []);


    // Sheet configuration
    data.sheetType = "npc";
    data.sheetTypeLabel = data.linkedActor?.type === 'character' ? "Player Journal" : "NPC Journal";
    // data.sheetTypeLabel = "NPC Journal";
    data.defaultImage = "icons/svg/mystery-man.svg";
    data.customImage = this.document.getFlag("campaign-codex", "image") || data.linkedActor?.img || "icons/svg/mystery-man.svg";
    
    // Navigation tabs
    data.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'locations', label: 'Locations', icon: 'fas fa-map-marker-alt', active: this._currentTab === 'locations',
      statistic: {
        value: data.allLocations.length,
        color: '#28a745'
      } },
      { key: 'shops', label: 'Entries', icon: 'fas fa-book-open', active: this._currentTab === 'shops' ,
      statistic: {
        value: data.linkedShops.length,
        color: '#6f42c1'
      }},
      { key: 'associates', label: 'Associates', icon: 'fas fa-users', active: this._currentTab === 'associates',
      statistic: {
        value: data.associates.length,
        color: '#fd7e14'
      } },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    // Statistics - use all discovered locations
    data.statistics = [
      { icon: 'fas fa-map-marker-alt', value: data.allLocations.length, label: 'LOCATIONS', color: '#28a745' },
      { icon: 'fas fa-book-open', value: data.linkedShops.length, label: 'ENTRIES', color: '#6f42c1' },
      { icon: 'fas fa-users', value: data.associates.length, label: 'ASSOCIATES', color: '#fd7e14' }
    ];
    
    // Quick links - use all locations
    data.quickLinks = [
      ...data.allLocations.map(loc => ({ ...loc, type: 'location' })),
      ...data.linkedShops.map(shop => ({ ...shop, type: 'shop' })),
      ...data.associates.map(assoc => ({ ...assoc, type: 'npc' }))
    ];
    
    // Custom header content (actor stats)
    if (data.linkedActor) {
      data.customHeaderContent = `
        <div class="actor-stats">
          <div class="stat-row">
            <span class="stat-label">AC </span><span class="stat-value">${data.linkedActor.ac}   </span>
            <span class="stat-label">HP </span><span class="stat-value">${data.linkedActor.hp.value}/${data.linkedActor.hp.max}</span>
          </div>
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
        key: 'locations',
        active: this._currentTab === 'locations',
        content: this._generateLocationsTab(data)
      },
      {
        key: 'shops', 
        active: this._currentTab === 'shops',
        content: this._generateShopsTab(data)
      },
      {
        key: 'associates',
        active: this._currentTab === 'associates', 
        content: this._generateAssociatesTab(data)
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
    let actorSection = '';
    let dropToMapBtn = '';


    dropToMapBtn = (canvas.scene && data.linkedActor) ? `
    <button type="button" class="refresh-btn npcs-to-map-button" title="Drop to current scene">
      <i class="fas fa-map"></i>
      Drop NPC
    </button>
  ` : '';




    if (data.linkedActor) {
      actorSection = `
        <div class="form-section">
          <h3><i class="fas fa-link"></i> Linked Actor</h3>
          ${TemplateComponents.actorLinkCard(data.linkedActor)}
        </div>
      `;

    } else {
      actorSection = `
        <div class="form-section">
          <h3><i class="fas fa-link"></i> Link Actor</h3>
          ${TemplateComponents.dropZone('actor', 'fas fa-user-plus', 'Link Actor', 'Drag an NPC actor here to link')}
        </div>
      `;
    }
    
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information', dropToMapBtn)}
      ${actorSection}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }

  _generateLocationsTab(data) {
    const refreshBtn = `
      <button type="button" class="refresh-btn refresh-locations" title="Refresh location data">
        <i class="fas fa-sync-alt"></i>
        Refresh
      </button>
    `;

    return `
      ${TemplateComponents.contentHeader('fas fa-map-marker-alt', 'Locations', refreshBtn)}
      ${TemplateComponents.dropZone('location', 'fas fa-map-marker-alt', 'Add Locations', 'Drag location journals here to associate this NPC with them')}
      ${this._generateLocationsBySource(data)}
    `;
  }

  _generateLocationsBySource(data) {
    // Separate direct and shop-based locations
    const directLocations = data.allLocations.filter(loc => loc.source === 'direct');
    const shopLocations = data.allLocations.filter(loc => loc.source === 'shop');

    let content = '';

    // Direct locations
    if (directLocations.length > 0) {
      content += `
        <div class="location-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-map-marker-alt" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Direct Locations (${directLocations.length})
          </h3>
          ${TemplateComponents.entityGrid(directLocations, 'location')}
        </div>
      `;
    }

    // Shop-based locations
    if (shopLocations.length > 0) {
      content += `
        <div class="location-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-book-open" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Shop Locations (${shopLocations.length})
          </h3>
          ${TemplateComponents.infoBanner('Locations where this NPC works through shop associations.')}
          ${TemplateComponents.entityGrid(shopLocations, 'location')}
        </div>
      `;
    }

    if (data.allLocations.length === 0) {
      content = TemplateComponents.emptyState('location');
    }

    return content;
  }

  _generateShopsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-book-open', 'Associated Entries')}
      ${TemplateComponents.dropZone('shop', 'fas fa-book-open', 'Add Entries', 'Drag entry journals here to associate this NPC with them')}
      ${TemplateComponents.entityGrid(data.linkedShops, 'shop')}
    `;
  }

  _generateAssociatesTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-users', 'Associates & Contacts')}
      ${TemplateComponents.dropZone('associate', 'fas fa-user-friends', 'Add Associates', 'Drag NPC journals or actors here to create relationships')}
      ${TemplateComponents.entityGrid(data.associates, 'associate', true)}
    `;
  }





  _activateSheetSpecificListeners(html) {
    // Remove buttons - only allow removing direct locations
    html.find('.remove-location').click(async (e) => {
      e.stopPropagation();
      
      // Check if this button is disabled (shop-based location)
      if (e.currentTarget.style.opacity === '0.3' || e.currentTarget.style.cursor === 'not-allowed') {
        ui.notifications.warn("Cannot remove shop-based locations directly. Remove the NPC from the shop instead.");
        return;
      }
      
      // Check data-source attribute as backup
      const locationCard = e.currentTarget.closest('.entity-card');
      const isShopLocation = locationCard.getAttribute('data-source') === 'shop';
      
      if (isShopLocation) {
        ui.notifications.warn("Cannot remove shop-based locations directly. Remove the NPC from the shop instead.");
        return;
      }
      
      await this._onRemoveFromList(e, 'linkedLocations');
    });
    // html.find('.cc-edit-description').click(event => this._onEditDescription(event, 'description'));
    // html.find('.cc-edit-notes').click(event => this._onEditDescription(event, 'notes'));


    html.find('.remove-actor').click(this._onRemoveActor.bind(this));
    html.find('.remove-shop').click(async (e) => await this._onRemoveFromList(e, 'linkedShops'));
    html.find('.remove-associate').click(async (e) => await this._onRemoveFromList(e, 'associates'));

    // Open buttons
    html.find('.open-actor').click(async (e) => await this._onOpenDocument(e, 'actor'));
    html.find('.open-location').click(async (e) => await this._onOpenDocument(e, 'location'));
    html.find('.open-shop').click(async (e) => await this._onOpenDocument(e, 'shop'));
    html.find('.open-npc').click(async (e) => await this._onOpenDocument(e, 'npc'));
    html.find('.open-associate').click(async (e) => await this._onOpenDocument(e, 'associate'));

    // Refresh button
    html.find('.refresh-locations').click(this._onRefreshLocations.bind(this));

    // Quick links
    html.find('.location-link').click(async (e) => await this._onOpenDocument(e, 'location'));
    html.find('.shop-link').click(async (e) => await this._onOpenDocument(e, 'shop'));
    html.find('.npc-link').click(async (e) => await this._onOpenDocument(e, 'npc'));
  }


async _onRefreshLocations(event) {
  console.log(`Campaign Codex | Manual refresh requested for NPC: ${this.document.name}`);
  
  // Log current shop links for debugging
  const npcData = this.document.getFlag("campaign-codex", "data") || {};
  const linkedShops = npcData.linkedShops || [];
  console.log(`Campaign Codex | Current linked shops:`, linkedShops);
  
  // Force a complete re-render which will recalculate all locations
  this.render(false);
  ui.notifications.info("Location data refreshed! Shop-based locations have been recalculated.");
}

// Also add this helper method to force location recalculation
async _forceLocationRecalculation() {
  console.log(`Campaign Codex | Forcing location recalculation for NPC: ${this.document.name}`);
  
  // Get fresh data and log for debugging
  const npcData = this.document.getFlag("campaign-codex", "data") || {};
  const directLocations = npcData.linkedLocations || [];
  const linkedShops = npcData.linkedShops || [];
  
  console.log(`Campaign Codex | Direct locations:`, directLocations);
  console.log(`Campaign Codex | Linked shops:`, linkedShops);
  
  // Verify each shop link
for (const shopUuid of linkedShops) { // Change parameter name from shopId to shopUuid
  const shop = await fromUuid(shopUuid); // Remove fallback to game.journal.get()
  if (shop) {
    const shopData = shop.getFlag("campaign-codex", "data") || {};
    const shopNPCs = shopData.linkedNPCs || [];
    const shopLocation = shopData.linkedLocation;
    
    console.log(`Campaign Codex | Shop ${shop.name}:`, {
      linksToThisNPC: shopNPCs.includes(this.document.uuid), // Change to document.uuid
      location: shopLocation,
      allNPCs: shopNPCs
    });
  }
}
  
  // Force re-render
  this.render(false);
}

  async _handleDrop(data, event) {
    if (data.type === "Actor") {
      await this._handleActorDrop(data, event);
    } else if (data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
    }
  }


  async _handleJournalDrop(data, event) {
    // Always use UUID - construct it if only ID is provided
    let journalUuid = data.uuid;
    if (!journalUuid && data.id) {
      journalUuid = `JournalEntry.${data.id}`;
    }
    
    if (!journalUuid) {
      ui.notifications.warn("Could not determine journal UUID");
      return;
    }
    
    const journal = await fromUuid(journalUuid);
    if (!journal || journal.id === this.document.id) return; // Prevent self-linking

    const journalType = journal.getFlag("campaign-codex", "type");
    
    if (journalType === "location") {
      await this._saveFormData();
      await game.campaignCodex.linkLocationToNPC(journal, this.document);
      this.render(false);
    } else if (journalType === "shop") {
      await this._saveFormData();
      await game.campaignCodex.linkShopToNPC(journal, this.document);
      this.render(false);
    } else if (journalType === "npc") {
      await this._saveFormData();
      await game.campaignCodex.linkNPCToNPC(this.document, journal);
      this.render(false);
    }
  }

  async _onRemoveActor(event) {
     await this._saveFormData();
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.linkedActor = null;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
  }

  getSheetType() {
    return "npc";
  }
async _onDropNPCsToMapClick(event) {
  event.preventDefault();
  
  // Get the current NPC's data
  const npcData = this.document.getFlag("campaign-codex", "data") || {};
  
  // Check if this NPC has a linked actor
  if (!npcData.linkedActor) {
    ui.notifications.warn("This NPC has no linked actor to drop!");
    return;
  }
  
  try {
    // Get the linked actor
    const linkedActor = await fromUuid(npcData.linkedActor);
    if (!linkedActor) {
      ui.notifications.warn("Linked actor not found!");
      return;
    }
    
    // Create NPC object for dropping (matching the expected format)
    const npcForDrop = {
      id: this.document.id,
      uuid: this.document.uuid,
      name: this.document.name,
      img: this.document.getFlag("campaign-codex", "image") || linkedActor.img || "icons/svg/mystery-man.svg",
      actor: linkedActor
    };
    
    // Drop this single NPC
    await this._onDropNPCsToMap([npcForDrop], { 
      title: `Drop ${this.document.name} to Map`,
      showHiddenToggle: true
    });
    
  } catch (error) {
    console.error('Campaign Codex | Error dropping NPC to map:', error);
    ui.notifications.error("Failed to drop NPC to map!");
  }
}

}