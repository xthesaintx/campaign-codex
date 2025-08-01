import { CampaignManager } from './campaign-manager.js';
import { LocationSheet } from './sheets/location-sheet.js';
import { ShopSheet } from './sheets/shop-sheet.js';
import { NPCSheet } from './sheets/npc-sheet.js';
import { RegionSheet } from './sheets/region-sheet.js';
import { CleanUp } from './cleanup.js';
import { SimpleCampaignCodexExporter } from './campaign-codex-exporter.js';
import { CampaignCodexJournalConverter } from './campaign-codex-convertor.js';
import { NPCDropper } from './npc-dropper.js';
import { CampaignCodexTokenPlacement } from './token-placement.js';
import { GroupSheet } from './sheets/group-sheet.js';


Hooks.once('init', async function() {
  console.log('Campaign Codex | Initializing');
  // CONFIG.debug.hooks = true;

  // Register sheet classes
  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", LocationSheet, {
    makeDefault: false,
    label: "Campaign Codex: Location"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", ShopSheet, {
    makeDefault: false,
    label: "Campaign Codex: Shop"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", NPCSheet, {
    makeDefault: false,
    label: "Campaign Codex: NPC"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", RegionSheet, {
    makeDefault: false,
    label: "Campaign Codex: Region"
  });
    // Register Group Sheet
  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", GroupSheet, {
    makeDefault: false,
    label: "Campaign Codex: Group Overview"
  });

  // Register settings
  // game.settings.register("campaign-codex", "showPlayerNotes", {
  //   name: "Show Player Notes Section",
  //   hint: "Allow players to add their own notes",
  //   scope: "world",
  //   config: true,
  //   type: Boolean,
  //   default: false
  // });

  game.settings.register("campaign-codex", "useOrganizedFolders", {
    name: "Organize in Folders",
    hint: "Automatically create and organise Campaign Codex journals in folders",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  console.log('Campaign Codex | Sheets registered');
});

Hooks.once('ready', async function() {
  console.log('Campaign Codex | Ready');
  
  // Initialize the campaign manager
  game.campaignCodex = new CampaignManager();
  game.campaignCodexCleanup = new CleanUp();
  game.campaignCodexNPCDropper = NPCDropper;
  game.campaignCodexTokenPlacement = CampaignCodexTokenPlacement;
  window.CampaignCodexTokenPlacement = CampaignCodexTokenPlacement;

  // Make the exporter globally available for button clicks
  window.SimpleCampaignCodexExporter = SimpleCampaignCodexExporter;

  // Create organization folders if setting is enabled
  if (game.settings.get("campaign-codex", "useOrganizedFolders")) {
    await ensureCampaignCodexFolders();
  }
});

// Ensure Campaign Codex folders exist
async function ensureCampaignCodexFolders() {
  const folderNames = {
    "Campaign Codex - Locations": "location",
    "Campaign Codex - Entries": "shop", 
    "Campaign Codex - NPCs": "npc",
    "Campaign Codex - Regions": "region",
    "Campaign Codex - Groups": "group"
  };

  for (const [folderName, type] of Object.entries(folderNames)) {
    let folder = game.folders.find(f => f.name === folderName && f.type === "JournalEntry");
    
    if (!folder) {
      await Folder.create({
        name: folderName,
        type: "JournalEntry",
        color: getFolderColor(type),
        flags: {
          "campaign-codex": {
            type: type,
            autoOrganize: true
          }
        }
      });
      console.log(`Campaign Codex | Created folder: ${folderName}`);
    }
  }
}

function getFolderColor(type) {
  const colors = {
    location: "#28a745",
    shop: "#6f42c1", 
    npc: "#fd7e14",
    region: "#20c997",
    group:"#17a2b8"
  };
  return colors[type] || "#999999";
}

// Get appropriate folder for document type
function getCampaignCodexFolder(type) {
  if (!game.settings.get("campaign-codex", "useOrganizedFolders")) return null;
  
  const folderNames = {
    location: "Campaign Codex - Locations",
    shop: "Campaign Codex - Entries",
    npc: "Campaign Codex - NPCs", 
    region: "Campaign Codex - Regions",
    group: "Campaign Codex - Groups"
  };
  
  const folderName = folderNames[type];
  return game.folders.find(f => f.name === folderName && f.type === "JournalEntry");
}

// Add context menu options to actors
Hooks.on('getActorDirectoryEntryContext', (html, options) => {
  options.push({
    name: "Create NPC Journal",
    icon: '<i class="fas fa-user"></i>',
    condition: li => {
      const actorUuid = li.data("uuid") || `Actor.${li.data("documentId")}`;
      const actor = fromUuidSync(actorUuid);
      return actor && actor.type === "npc" && !game.journal.find(j => {
        const npcData = j.getFlag("campaign-codex", "data");
        return npcData && npcData.linkedActor === actor.uuid;
      });
    },
    callback: async li => {
      const actorUuid = li.data("uuid") || `Actor.${li.data("documentId")}`;
      const actor = await fromUuid(actorUuid);
      if (actor) {
        await game.campaignCodex.createNPCJournal(actor);
      }
    }
  });

});

// Add journal entry creation buttons
Hooks.on('getJournalDirectoryEntryContext', (html, options) => {
  options.push({
    name: "Export to Standard Journal",
    icon: '<i class="fas fa-book"></i>',
    condition: li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = fromUuidSync(journalUuid);
      return journal && journal.getFlag("campaign-codex", "type");
    },
    callback: async li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = await fromUuid(journalUuid);
      if (journal) {
        await CampaignCodexJournalConverter.showExportDialog(journal);
      }
    }
  });
    options.push({
    name: "Add to Group",
    icon: '<i class="fas fa-plus-circle"></i>',
    condition: li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = fromUuidSync(journalUuid);
      const journalType = journal?.getFlag("campaign-codex", "type");
      return journalType && ['region', 'location', 'shop', 'npc'].includes(journalType) && game.user.isGM;
    },
    callback: async li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = await fromUuid(journalUuid);
      if (journal) {
        await showAddToGroupDialog(journal);
      }
    }
  });
});

// Helper function for add to group dialog
async function showAddToGroupDialog(journal) {
  const groupJournals = game.journal.filter(j => j.getFlag("campaign-codex", "type") === "group");
  
  if (groupJournals.length === 0) {
    ui.notifications.warn("No group overviews found. Create one first.");
    return;
  }

  const options = groupJournals.map(group => 
    `<option value="${group.uuid}">${group.name}</option>`
  ).join('');

  return new Promise((resolve) => {
    new Dialog({
      title: "Add to Group",
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label>Select Group:</label>
            <select name="groupUuid" style="width: 100%;">
              ${options}
            </select>
          </div>
          <p style="font-size: 12px; color: #666; margin: 8px 0;">
            This will add "${journal.name}" to the selected group overview.
          </p>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Add to Group",
          callback: async (html) => {
            const groupUuid = html.find('[name="groupUuid"]').val();
            const groupJournal = await fromUuid(groupUuid);
            
            if (groupJournal) {
              const groupData = groupJournal.getFlag("campaign-codex", "data") || {};
              const members = groupData.members || [];
              
              if (!members.includes(journal.uuid)) {
                members.push(journal.uuid);
                groupData.members = members;
                await groupJournal.setFlag("campaign-codex", "data", groupData);
                ui.notifications.info(`Added "${journal.name}" to group "${groupJournal.name}"`);
                
                // Refresh any open group sheets
                for (const app of Object.values(ui.windows)) {
                  if (app.document && app.document.uuid === groupJournal.uuid) {
                    app.render(false);
                    break;
                  }
                }
              } else {
                ui.notifications.warn(`"${journal.name}" is already in this group.`);
              }
            }
            resolve();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve()
        }
      },
      default: "add"
    }).render(true);
  });
}

// Campaign Codex Export/Import buttons
Hooks.on('renderJournalDirectory', (app, html, data) => {
    if (!game.user.isGM) return;

  // Remove any existing buttons to prevent duplicates
  html.find('.campaign-codex-export-buttons').remove();
  
  const hasCampaignCodex = game.journal.some(j => j.getFlag("campaign-codex", "type"));
  
  // Create button container
  const buttonContainer = $(`
    <div class="campaign-codex-export-buttons" style="margin: 8px; display: flex; gap: 4px;">
      ${hasCampaignCodex ? `
        <button onclick="SimpleCampaignCodexExporter.exportCampaignCodexToCompendium()" type="button" title="Export all Campaign Codex content to compendium" style="flex: 1; padding: 4px 8px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; height: auto">
          <i class="fas fa-download"></i> Export Campaign Codex
        </button>
      ` : ''}
    </div>
  `);


  // Insert at the bottom of the directory
  const footer = html.find('.directory-footer');
  if (footer.length > 0) {
    footer.append(buttonContainer);
  } else {
    html.find('.directory-list').after(buttonContainer);
  }

  // Create the button container
  const buttonGrouphead = $(`
    <div class="campaign-codex-buttons" style="margin: 8px 0; display: flex; gap: 4px; flex-wrap: wrap;">
      <button class="create-region-btn" type="button" title="Create New Region" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #20c997; color: white; border: none; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-globe"></i>
      </button>
      <button class="create-location-btn" type="button" title="Create New Location" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-map-marker-alt"></i>
      </button>
      <button class="create-shop-btn" type="button" title="Create New Entry" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #6f42c1; color: white; border: none; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-book-open"></i>
      </button>
      <button class="create-npc-btn" type="button" title="Create New NPC Journal" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #fd7e14; color: white; border: none; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-user"></i>
      </button>
      <button class="create-group-btn" type="button" title="Create New Group Overview" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-layer-group"></i>
      </button>
    </div>
  `);






  // Insert into the directory header
  const directoryHeader = html.find('.directory-header');
  directoryHeader.append(buttonGrouphead);

  // Event listeners for the buttons
  html.find('.create-location-btn').click(async () => {
    const name = await promptForName("Location");
    if (name) await game.campaignCodex.createLocationJournal(name);
  });

  html.find('.create-shop-btn').click(async () => {
    const name = await promptForName("Entry");
    if (name) await game.campaignCodex.createShopJournal(name);
  });

  html.find('.create-npc-btn').click(async () => {
    const name = await promptForName("NPC Journal");
    if (name) await game.campaignCodex.createNPCJournal(null, name);
  });

  html.find('.create-region-btn').click(async () => {
    const name = await promptForName("Region");
    if (name) await game.campaignCodex.createRegionJournal(name);
  });

    // Add event listener for group button
    html.find('.create-group-btn').click(async () => {
      const name = await promptForName("Group Overview");
      if (name) await game.campaignCodex.createGroupJournal(name);
    });



});



// Force correct sheet to open immediately upon creation
Hooks.on('createJournalEntry', async (document, options, userId) => {
  if (game.user.id !== userId) return;
  
  const journalType = document.getFlag("campaign-codex", "type");
  if (!journalType) return;

  if (document.pack) {
    console.log("Campaign Codex | Skipping auto-open for compendium document");
    return;
  }

  // Move to appropriate folder
  const folder = getCampaignCodexFolder(journalType);
  if (folder) {
    await document.update({ folder: folder.id });
  }

  // Set the correct sheet type immediately
  let sheetClass = null;
  switch (journalType) {
    case "location":
      sheetClass = "campaign-codex.LocationSheet";
      break;
    case "shop":
      sheetClass = "campaign-codex.ShopSheet";
      break;
    case "npc":
      sheetClass = "campaign-codex.NPCSheet";
      break;
    case "region":
      sheetClass = "campaign-codex.RegionSheet";
      break;
    case "group":
      sheetClass = "campaign-codex.GroupSheet";
      break;  
  }
  

  
  if (sheetClass) {
    await document.update({
      "flags.core.sheetClass": sheetClass
    });
  }

  // Open the correct sheet
  setTimeout(() => {
    let targetSheet = null;

    switch (journalType) {
      case "location":
        targetSheet = LocationSheet;
        break;
      case "shop":
        targetSheet = ShopSheet;
        break;
      case "npc":
        targetSheet = NPCSheet;
        break;
      case "region":
        targetSheet = RegionSheet;
        break;
      case "group":
        targetSheet = GroupSheet;
        break;
    }

    if (targetSheet) {
      if (document.sheet.rendered) {
        document.sheet.close();
      }
      const sheet = new targetSheet(document);
      sheet.render(true);
      document._campaignCodexSheet = sheet;
    }
  }, 100);
});

// Auto-select appropriate sheet based on flags for existing documents
Hooks.on('renderJournalEntry', (journal, html, data) => {
  const journalType = journal.getFlag("campaign-codex", "type");
  if (!journalType) return;

  const currentSheetName = journal.sheet.constructor.name;
  let targetSheet = null;

  switch (journalType) {
    case "location":
      if (currentSheetName !== "LocationSheet") targetSheet = LocationSheet;
      break;
    case "shop":
      if (currentSheetName !== "ShopSheet") targetSheet = ShopSheet;
      break;
    case "npc":
      if (currentSheetName !== "NPCSheet") targetSheet = NPCSheet;
      break;
    case "region":
      if (currentSheetName !== "RegionSheet") targetSheet = RegionSheet;
      break;
    case "group":
      if (currentSheetName !== "GroupSheet") targetSheet = GroupSheet;
      break;

  }

  if (targetSheet) {
    setTimeout(() => {
      journal.sheet.close();
      const sheet = new targetSheet(journal);
      sheet.render(true);
      journal._campaignCodexSheet = sheet;
    }, 100);
  }
});

// Helper function to prompt for name
async function promptForName(type) {
  return new Promise((resolve) => {
    new Dialog({
      title: `Create New ${type}`,
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label>Name:</label>
            <input type="text" name="name" placeholder="Enter ${type.toLowerCase()} name..." autofocus style="width: 100%;" />
          </div>
        </form>
      `,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          callback: (html) => {
            const name = html.find('[name="name"]').val().trim();
            resolve(name || `New ${type}`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "create",
      render: (html) => {
        html.find('input[name="name"]').focus().keypress((e) => {
          if (e.which === 13) {
            html.closest('.dialog').find('.dialog-button.create button').click();
          }
        });
      }
    }).render(true);
  });
}


// Handle bidirectional relationship updates and sheet refreshing
Hooks.on('updateJournalEntry', async (document, changes, options, userId) => {
  if (document._skipRelationshipUpdates) return;
  if (game.user.id !== userId) return;
  
  const type = document.getFlag("campaign-codex", "type");
  if (!type) return;

  try {
    // Handle relationship updates first
    await game.campaignCodex.handleRelationshipUpdates(document, changes, type);
    
    // Then refresh all related open sheets
    setTimeout(async () => {
      const documentId = document.id;
      
      // Get all open applications
      for (const app of Object.values(ui.windows)) {
        if (!app.document || !app.document.getFlag) continue;
        
        const appDocumentId = app.document.id;
        const appType = app.document.getFlag("campaign-codex", "type");
        
        // Check if this is a Campaign Codex sheet that needs refreshing
        if (appType && (appDocumentId === documentId || app._isRelatedDocument?.(document.uuid))) {
          // console.log(`Campaign Codex | Refreshing ${appType} sheet: ${app.document.name}`);
          app.render(false);
        }
      }
    }, 150); // Slightly longer delay to ensure relationship updates complete
    
  } catch (error) {
    console.error('Campaign Codex | Error in updateJournalEntry hook:', error);
  }
});

Hooks.on('updateActor', async (actor, changes, options, userId) => {
  if (game.user.id !== userId) return;
  
  // Only care about image changes
  if (!changes.img) return;
  
  console.log(`Campaign Codex | Actor image updated: ${actor.name}`);
  
  // Find all NPC journals that link to this actor
  const linkedNPCs = game.journal.filter(j => {
    const npcData = j.getFlag("campaign-codex", "data");
    return npcData && npcData.linkedActor === actor.uuid;
  });
  
  if (linkedNPCs.length === 0) return;
  
  console.log(`Campaign Codex | Found ${linkedNPCs.length} NPC journals linked to actor ${actor.name}`);
  
  // Refresh any open NPC sheets for this actor
  setTimeout(async () => {
    for (const npcJournal of linkedNPCs) {
      // Find and refresh the NPC sheet if it's open
      for (const app of Object.values(ui.windows)) {
        if (app.document && app.document.uuid === npcJournal.uuid) {
          console.log(`Campaign Codex | Refreshing NPC sheet: ${npcJournal.name}`);
          app.render(false);
          break;
        }
      }
      
      // Also refresh any related sheets that might show this NPC
      setTimeout(async () => {
        for (const app of Object.values(ui.windows)) {
          if (!app.document || !app.document.getFlag || app.document.uuid === npcJournal.uuid) continue;
          
          const appType = app.document.getFlag("campaign-codex", "type");
          if (appType && app._isRelatedDocument && await app._isRelatedDocument(npcJournal.uuid)) {
            console.log(`Campaign Codex | Refreshing related sheet showing NPC: ${app.document.name}`);
            app.render(false);
          }
        }
      }, 100);
    }
  }, 150);
});

// Export folder management functions for use in campaign manager
window.getCampaignCodexFolder = getCampaignCodexFolder;
