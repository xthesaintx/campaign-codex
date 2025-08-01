import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class RegionSheet extends CampaignCodexBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, "region-sheet"]
    });
  }

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  async getData() {
    const data = await super.getData();
    const regionData = this.document.getFlag("campaign-codex", "data") || {};

  data.linkedScene = null;
  if (regionData.linkedScene) {
    try {
      const scene = await fromUuid(regionData.linkedScene);
      if (scene) {
        data.linkedScene = {
          uuid: scene.uuid,
          name: scene.name,
          img: scene.thumb || "icons/svg/map.svg"
        };
      }
    } catch (error) {
      console.warn(`Campaign Codex | Linked scene not found: ${regionData.linkedScene}`);
    }
  }



     
    // Get linked documents with complete hierarchy
    data.linkedLocations = await CampaignCodexLinkers.getLinkedLocations(this.document,regionData.linkedLocations || []);
    data.allNPCs = await CampaignCodexLinkers.getAllNPCs(regionData.linkedLocations || []);
    data.allShops = await CampaignCodexLinkers.getAllShops(regionData.linkedLocations || []);
    
    // Sheet configuration
    data.sheetType = "region";
    data.sheetTypeLabel = "Region";
    data.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image','region');
    
    // Navigation tabs
    data.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'locations', label: 'Locations', icon: 'fas fa-map-marker-alt', active: this._currentTab === 'locations' ,
      statistic: {
        value: Array.isArray(data.linkedLocations) ? data.linkedLocations.length : 0,
        color: '#28a745'
      }},
      { key: 'npcs', label: 'NPCs', icon: 'fas fa-users', active: this._currentTab === 'npcs' ,
      statistic: {
        value: Array.isArray(data.allNPCs) ? data.allNPCs.length : 0,
        color: '#fd7e14'
      }},
      { key: 'shops', label: 'Entries', icon: 'fas fa-book-open', active: this._currentTab === 'shops' ,
      statistic: {
        value: Array.isArray(data.allShops) ? data.allShops.length : 0,
        color: '#6f42c1'
      }},
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    // Statistics
    data.statistics = [
      { icon: 'fas fa-map-marker-alt', value: data.linkedLocations.length, label: 'LOCATIONS', color: '#28a745' },
      { icon: 'fas fa-users', value: data.allNPCs.length, label: 'NPCS', color: '#fd7e14' },
      { icon: 'fas fa-book-open', value: data.allShops.length, label: 'ENTRIES', color: '#6f42c1' }
    ];
    
    // // Quick links
    // data.quickLinks = [
    //   ...data.linkedLocations.map(loc => ({ ...loc, type: 'location' }))
    // ];
    
          const sources = [
    { data: data.linkedLocations, type: 'location' },
  ];

  // Generate the de-duplicated quick links
  data.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);




  // Update custom header content
  let headerContent = '';
  
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
  
  if (headerContent) {
    data.customHeaderContent = headerContent;

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

    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information')}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;  }

  _generateLocationsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-map-marker-alt', 'Locations in this Region')}
      ${TemplateComponents.dropZone('location', 'fas fa-map-marker-alt', 'Add Locations', 'Drag location journals here to add them to this region')}
      ${TemplateComponents.entityGrid(data.linkedLocations, 'location')}
    `;
  }

  _generateNPCsTab(data) {
    const refreshBtn = `
      <button type="button" class="refresh-btn refresh-npcs" title="Refresh auto-populated data">
        <i class="fas fa-sync-alt"></i>
        Refresh
      </button>
    `;

    return `
      ${TemplateComponents.contentHeader('fas fa-users', 'NPCs in this Region', refreshBtn)}
      ${TemplateComponents.infoBanner('NPCs are automatically populated from all locations and entries in this region.')}
      ${this._generateNPCsBySource(data)}
    `;
  }

  _generateNPCsBySource(data) {
    // Group NPCs by their source
    const directNPCs = data.allNPCs.filter(npc => npc.source === 'location');
    const shopNPCs = data.allNPCs.filter(npc => npc.source === 'shop');

    let content = '';

    // Direct Location NPCs
    if (directNPCs.length > 0) {
      content += `
        <div class="npc-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-map-marker-alt" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Location NPCs (${directNPCs.length})
          </h3>
          ${TemplateComponents.entityGrid(directNPCs, 'npc', true)}
        </div>
      `;
    }

    // Shop NPCs
    if (shopNPCs.length > 0) {
      content += `
        <div class="npc-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fa-book-open" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Shop NPCs (${shopNPCs.length})
          </h3>
          ${TemplateComponents.entityGrid(shopNPCs, 'npc', true)}
        </div>
      `;
    }

    // If no NPCs
    if (data.allNPCs.length === 0) {
      content = TemplateComponents.emptyState('npc');
    }

    return content;
  }

  _generateShopsTab(data) {
    const refreshBtn = `
      <button type="button" class="refresh-btn refresh-shops" title="Refresh auto-populated data">
        <i class="fas fa-sync-alt"></i>
        Refresh
      </button>
    `;

    return `
      ${TemplateComponents.contentHeader('fas fa-book-open', 'Entries in this Region', refreshBtn)}
      ${TemplateComponents.infoBanner('Entries are automatically populated from all locations in this region.')}
      ${TemplateComponents.entityGrid(data.allShops, 'shop')}
    `;
  }



  _activateSheetSpecificListeners(html) {
    // Remove buttons
    // html.find('.remove-location').click(async (e) => await this._onRemoveFromList(e, 'linkedLocations'));
    html.find('.remove-location').click(this._onRemoveFromRegion.bind(this)); 

    // Open buttons
    html.find('.open-location').click(async (e) => await this._onOpenDocument(e, 'location'));
    html.find('.open-npc').click(async (e) => await this._onOpenDocument(e, 'npc'));
    html.find('.open-shop').click(async (e) => await this._onOpenDocument(e, 'shop'));
    html.find('.open-actor').click(async (e) => await this._onOpenDocument(e, 'actor'));

    // Refresh buttons
    html.find('.refresh-npcs').click(this._onRefreshData.bind(this));
    html.find('.refresh-shops').click(this._onRefreshData.bind(this));

    // Quick links
    html.find('.location-link').click(async (e) => await this._onOpenDocument(e, 'location'));
    // html.find('.cc-edit-description').click(event => this._onEditDescription(event, 'description'));
    // html.find('.cc-edit-notes').click(event => this._onEditDescription(event, 'notes'));
html.find('.open-scene').click(this._onOpenScene.bind(this));
html.find('.remove-scene').click(this._onRemoveScene.bind(this));



  }
// Add these methods to the sheet classes
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
  } else if(data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
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



  async _handleJournalDrop(data, event) {
    const journal = await fromUuid(data.uuid);
    if (!journal || journal.uuid === this.document.uuid) return;

    const journalType = journal.getFlag("campaign-codex", "type");
    
    if (journalType === "location") {
      await this._saveFormData();
      await game.campaignCodex.linkRegionToLocation(this.document, journal);
      this.render(false);
    }
  }

  async _onRefreshData(event) {
    this.render(false);
    ui.notifications.info("Region data refreshed!");
  }

  getSheetType() {
    return "region";
  }


// Add the drop to map handler
async _onDropToMap(event) {
  const data = await this.getData();
  await NPCDropper.dropNPCsToScene(data.linkedNPCs, {
    title: `Drop ${this.document.name} NPCs to Map`,
    showHiddenToggle: true
  });
}


  
}