// scripts/cleanup.js
export class CleanUp {
  constructor() {
    this.setupHooks();
  }

  setupHooks() {
    // Cleanup relationships when documents are deleted
    Hooks.on('preDeleteJournalEntry', async (document, options, userId) => {
      // Mark document as pending deletion to prevent cleanup loops
      document._pendingDeletion = true;
      
      const type = document.getFlag("campaign-codex", "type");
      if (!type) return;

      try {
        // Comprehensive cleanup for all document types
        await this.performComprehensiveCleanup(document, type);
      } catch (error) {
        console.warn(`Campaign Codex | Cleanup failed for ${document.name}:`, error);
        // Don't throw - allow deletion to proceed
      }
    });

    // Close any open sheets when a document is deleted
    Hooks.on('deleteJournalEntry', async (document, options, userId) => {
      const type = document.getFlag("campaign-codex", "type");
      if (!type) return;

      // Close any open Campaign Codex sheets for this document
      for (const app of Object.values(ui.windows)) {
        if (app.document && app.document.id === document.id) {
          // Check if it's a Campaign Codex sheet (including GroupSheet)
          const isCampaignCodexSheet = [
            'LocationSheet', 
            'ShopSheet', 
            'NPCSheet', 
            'RegionSheet',
            'GroupSheet'  // Added GroupSheet
          ].includes(app.constructor.name);
          
          if (isCampaignCodexSheet) {
            console.log(`Campaign Codex | Closing sheet for deleted document: ${document.name}`);
            // Force close without trying to save
            app._forceClose = true;
            await app.close();
          }
        }
      }

      // Refresh any open group sheets that might have contained this document
      await this.refreshAffectedGroupSheets(document);
    });

    // Cleanup actor relationships when actors are deleted
    Hooks.on('preDeleteActor', async (document, options, userId) => {
      try {
        await this.cleanupActorRelationships(document);
      } catch (error) {
        console.warn(`Campaign Codex | Actor cleanup failed for ${document.name}:`, error);
      }
    });
  }

  /**
   * Comprehensive cleanup that searches ALL documents for relationships
   */
  async performComprehensiveCleanup(deletedDoc, type) {
    const deletedUuid = deletedDoc.uuid;
    const updatePromises = [];

    console.log(`Campaign Codex | Starting comprehensive cleanup for ${type}: ${deletedDoc.name}`);

    // Get ALL Campaign Codex documents for comprehensive search
    const allCCDocuments = game.journal.filter(j => j.getFlag("campaign-codex", "type"));

    switch (type) {
      case "region":
        updatePromises.push(...await this.cleanupRegionRelationships(deletedUuid, allCCDocuments));
        break;
      case "location":
        updatePromises.push(...await this.cleanupLocationRelationships(deletedUuid, allCCDocuments));
        break;
      case "shop":
        updatePromises.push(...await this.cleanupShopRelationships(deletedUuid, allCCDocuments));
        break;
      case "npc":
        updatePromises.push(...await this.cleanupNPCRelationships(deletedUuid, allCCDocuments));
        break;
      case "group":
        updatePromises.push(...await this.cleanupGroupRelationships(deletedUuid, allCCDocuments));
        break;
    }

    // Execute all updates in parallel
    if (updatePromises.length > 0) {
      console.log(`Campaign Codex | Executing ${updatePromises.length} cleanup updates`);
      await Promise.allSettled(updatePromises);
      console.log(`Campaign Codex | Cleanup completed for ${deletedDoc.name}`);
    }
  }

  async cleanupRegionRelationships(deletedUuid, allDocuments) {
    const updatePromises = [];

    // Remove region from all locations that reference it
    for (const doc of allDocuments) {
      const docType = doc.getFlag("campaign-codex", "type");
      const docData = doc.getFlag("campaign-codex", "data") || {};

      if (docType === "location" && docData.parentRegion === deletedUuid) {
        console.log(`Campaign Codex | Removing region reference from location: ${doc.name}`);
        updatePromises.push(
          doc.unsetFlag("campaign-codex", "data.parentRegion")
            .catch(err => console.warn(`Failed to update location ${doc.name}:`, err))
        );
      }

      // Remove from group members
      if (docType === "group" && docData.members && docData.members.includes(deletedUuid)) {
        console.log(`Campaign Codex | Removing region from group: ${doc.name}`);
        const updatedData = { ...docData };
        updatedData.members = updatedData.members.filter(uuid => uuid !== deletedUuid);
        updatePromises.push(
          doc.setFlag("campaign-codex", "data", updatedData)
            .catch(err => console.warn(`Failed to update group ${doc.name}:`, err))
        );
      }
    }

    return updatePromises;
  }

  async cleanupLocationRelationships(deletedUuid, allDocuments) {
    const updatePromises = [];

    for (const doc of allDocuments) {
      const docType = doc.getFlag("campaign-codex", "type");
      const docData = doc.getFlag("campaign-codex", "data") || {};
      let needsUpdate = false;
      const updatedData = { ...docData };

      switch (docType) {
        case "region":
          // Remove location from region's linkedLocations array
          if (docData.linkedLocations && docData.linkedLocations.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing location from region: ${doc.name}`);
            updatedData.linkedLocations = updatedData.linkedLocations.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "npc":
          // Remove location from NPC's linkedLocations array
          if (docData.linkedLocations && docData.linkedLocations.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing location from NPC: ${doc.name}`);
            updatedData.linkedLocations = updatedData.linkedLocations.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "shop":
          // Remove location reference from shop
          if (docData.linkedLocation === deletedUuid) {
            console.log(`Campaign Codex | Removing location reference from shop: ${doc.name}`);
            updatedData.linkedLocation = null;
            needsUpdate = true;
          }
          break;

        case "group":
          // Remove from group members
          if (docData.members && docData.members.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing location from group: ${doc.name}`);
            updatedData.members = updatedData.members.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;
      }

      if (needsUpdate) {
        updatePromises.push(
          doc.setFlag("campaign-codex", "data", updatedData)
            .catch(err => console.warn(`Failed to update ${docType} ${doc.name}:`, err))
        );
      }
    }

    return updatePromises;
  }

  async cleanupShopRelationships(deletedUuid, allDocuments) {
    const updatePromises = [];

    for (const doc of allDocuments) {
      const docType = doc.getFlag("campaign-codex", "type");
      const docData = doc.getFlag("campaign-codex", "data") || {};
      let needsUpdate = false;
      const updatedData = { ...docData };

      switch (docType) {
        case "location":
          // Remove shop from location's linkedShops array
          if (docData.linkedShops && docData.linkedShops.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing shop from location: ${doc.name}`);
            updatedData.linkedShops = updatedData.linkedShops.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "npc":
          // Remove shop from NPC's linkedShops array
          if (docData.linkedShops && docData.linkedShops.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing shop from NPC: ${doc.name}`);
            updatedData.linkedShops = updatedData.linkedShops.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "group":
          // Remove from group members
          if (docData.members && docData.members.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing shop from group: ${doc.name}`);
            updatedData.members = updatedData.members.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;
      }

      if (needsUpdate) {
        updatePromises.push(
          doc.setFlag("campaign-codex", "data", updatedData)
            .catch(err => console.warn(`Failed to update ${docType} ${doc.name}:`, err))
        );
      }
    }

    return updatePromises;
  }

  async cleanupNPCRelationships(deletedUuid, allDocuments) {
    const updatePromises = [];

    for (const doc of allDocuments) {
      const docType = doc.getFlag("campaign-codex", "type");
      const docData = doc.getFlag("campaign-codex", "data") || {};
      let needsUpdate = false;
      const updatedData = { ...docData };

      switch (docType) {
        case "location":
          // Remove NPC from location's linkedNPCs array
          if (docData.linkedNPCs && docData.linkedNPCs.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing NPC from location: ${doc.name}`);
            updatedData.linkedNPCs = updatedData.linkedNPCs.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "shop":
          // Remove NPC from shop's linkedNPCs array
          if (docData.linkedNPCs && docData.linkedNPCs.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing NPC from shop: ${doc.name}`);
            updatedData.linkedNPCs = updatedData.linkedNPCs.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "npc":
          // Remove from other NPCs' associates arrays (bidirectional)
          if (docData.associates && docData.associates.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing NPC association from: ${doc.name}`);
            updatedData.associates = updatedData.associates.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;

        case "group":
          // Remove from group members
          if (docData.members && docData.members.includes(deletedUuid)) {
            console.log(`Campaign Codex | Removing NPC from group: ${doc.name}`);
            updatedData.members = updatedData.members.filter(uuid => uuid !== deletedUuid);
            needsUpdate = true;
          }
          break;
      }

      if (needsUpdate) {
        updatePromises.push(
          doc.setFlag("campaign-codex", "data", updatedData)
            .catch(err => console.warn(`Failed to update ${docType} ${doc.name}:`, err))
        );
      }
    }

    return updatePromises;
  }

  async cleanupGroupRelationships(deletedUuid, allDocuments) {
    // Groups don't create bidirectional relationships, so no cleanup needed
    // But we could log this for completeness
    console.log(`Campaign Codex | No bidirectional cleanup needed for group deletion`);
    return [];
  }

  /**
   * Enhanced actor cleanup that searches all NPC journals
   */
  async cleanupActorRelationships(actorDoc) {
    const actorUuid = actorDoc.uuid;
    const updatePromises = [];

    console.log(`Campaign Codex | Starting actor cleanup for: ${actorDoc.name}`);

    // Find ALL NPC journals that link to this actor
    const npcJournals = game.journal.filter(j => {
      const data = j.getFlag("campaign-codex", "data");
      return data && data.linkedActor === actorUuid;
    });

    for (const journal of npcJournals) {
      console.log(`Campaign Codex | Removing actor link from NPC journal: ${journal.name}`);
      const data = journal.getFlag("campaign-codex", "data") || {};
      data.linkedActor = null;
      
      updatePromises.push(
        journal.setFlag("campaign-codex", "data", data)
          .catch(err => console.warn(`Failed to update NPC journal ${journal.name}:`, err))
      );
    }

    // Execute all updates
    if (updatePromises.length > 0) {
      await Promise.allSettled(updatePromises);
      console.log(`Campaign Codex | Actor cleanup completed, updated ${updatePromises.length} NPC journals`);
    }
  }

  /**
   * Refresh any open group sheets that might be affected by document deletion
   */
  async refreshAffectedGroupSheets(deletedDoc) {
    const deletedUuid = deletedDoc.uuid;

    for (const app of Object.values(ui.windows)) {
      if (app.constructor.name === 'GroupSheet' && app.document) {
        const groupData = app.document.getFlag("campaign-codex", "data") || {};
        const members = groupData.members || [];

        // If the deleted document was a direct member, refresh the group sheet
        if (members.includes(deletedUuid)) {
          console.log(`Campaign Codex | Refreshing affected group sheet: ${app.document.name}`);
          // Remove the deleted member from the group
          const updatedData = { ...groupData };
          updatedData.members = updatedData.members.filter(uuid => uuid !== deletedUuid);
          
          try {
            await app.document.setFlag("campaign-codex", "data", updatedData);
            app.render(false);
          } catch (error) {
            console.warn(`Failed to update group sheet ${app.document.name}:`, error);
          }
        }
      }
    }
  }

  /**
   * Manual cleanup function for when things get out of sync
   */
  static async performManualCleanup() {
    console.log("Campaign Codex | Starting manual cleanup of all relationships");
    
    const allCCDocuments = game.journal.filter(j => j.getFlag("campaign-codex", "type"));
    const brokenLinks = [];
    const fixPromises = [];

    for (const doc of allCCDocuments) {
      const type = doc.getFlag("campaign-codex", "type");
      const data = doc.getFlag("campaign-codex", "data") || {};

      // Check all UUID references in this document
      const uuidsToCheck = [];
      
      // Single references
      if (data.linkedActor) uuidsToCheck.push({ field: 'linkedActor', uuid: data.linkedActor });
      if (data.linkedLocation) uuidsToCheck.push({ field: 'linkedLocation', uuid: data.linkedLocation });
      if (data.parentRegion) uuidsToCheck.push({ field: 'parentRegion', uuid: data.parentRegion });

      // Array references
      ['linkedNPCs', 'linkedShops', 'linkedLocations', 'associates', 'members'].forEach(field => {
        if (Array.isArray(data[field])) {
          data[field].forEach(uuid => uuidsToCheck.push({ field, uuid, isArray: true }));
        }
      });

      // Check inventory items
      if (Array.isArray(data.inventory)) {
        data.inventory.forEach((item, index) => {
          if (item.itemUuid) {
            uuidsToCheck.push({ field: 'inventory', uuid: item.itemUuid, isArray: true, index });
          }
        });
      }

      // Verify each UUID
      for (const check of uuidsToCheck) {
        try {
          const linkedDoc = await fromUuid(check.uuid);
          if (!linkedDoc) {
            brokenLinks.push({
              document: doc,
              field: check.field,
              uuid: check.uuid,
              isArray: check.isArray,
              index: check.index
            });
          }
        } catch (error) {
          brokenLinks.push({
            document: doc,
            field: check.field,
            uuid: check.uuid,
            isArray: check.isArray,
            index: check.index
          });
        }
      }
    }

    console.log(`Campaign Codex | Found ${brokenLinks.length} broken links`);

    // Fix broken links
    const fixesByDocument = new Map();
    
    for (const broken of brokenLinks) {
      if (!fixesByDocument.has(broken.document.id)) {
        fixesByDocument.set(broken.document.id, {
          document: broken.document,
          data: { ...broken.document.getFlag("campaign-codex", "data") || {} }
        });
      }
      
      const fix = fixesByDocument.get(broken.document.id);
      
      if (broken.isArray) {
        if (broken.field === 'inventory' && broken.index !== undefined) {
          fix.data.inventory = fix.data.inventory.filter((_, i) => i !== broken.index);
        } else if (Array.isArray(fix.data[broken.field])) {
          fix.data[broken.field] = fix.data[broken.field].filter(uuid => uuid !== broken.uuid);
        }
      } else {
        fix.data[broken.field] = null;
      }
    }

    // Apply all fixes
    for (const fix of fixesByDocument.values()) {
      fixPromises.push(
        fix.document.setFlag("campaign-codex", "data", fix.data)
          .catch(err => console.warn(`Failed to fix ${fix.document.name}:`, err))
      );
    }

    await Promise.allSettled(fixPromises);
    
    console.log(`Campaign Codex | Manual cleanup completed. Fixed ${fixPromises.length} documents.`);
    ui.notifications.info(`Manual cleanup completed. Fixed ${brokenLinks.length} broken links in ${fixPromises.length} documents.`);
  }
}
// export class CleanUp {
//   constructor() {
//     this.setupHooks();
//   }

//   setupHooks() {
//     // Cleanup relationships when documents are deleted
//     Hooks.on('preDeleteJournalEntry', async (document, options, userId) => {
//       // Mark document as pending deletion to prevent cleanup loops
//       document._pendingDeletion = true;
      
//       const type = document.getFlag("campaign-codex", "type");
//       if (!type) return;

//       try {
//         await game.campaignCodex.cleanupRelationships(document, type);
//       } catch (error) {
//         console.warn(`Campaign Codex | Cleanup failed for ${document.name}:`, error);
//         // Don't throw - allow deletion to proceed
//       }
//     });

//     // Close any open sheets when a document is deleted
//     Hooks.on('deleteJournalEntry', async (document, options, userId) => {
//       const type = document.getFlag("campaign-codex", "type");
//       if (!type) return;

//       // Close any open Campaign Codex sheets for this document
//       for (const app of Object.values(ui.windows)) {
//         if (app.document && app.document.id === document.id) {
//           // Check if it's a Campaign Codex sheet
//           const isCampaignCodexSheet = [
//             'LocationSheet', 
//             'ShopSheet', 
//             'NPCSheet', 
//             'RegionSheet'
//           ].includes(app.constructor.name);
          
//           if (isCampaignCodexSheet) {
//             //console.log (`Campaign Codex | Closing sheet for deleted document: ${document.name}`);
//             // Force close without trying to save
//             app._forceClose = true;
//             await app.close();
//           }
//         }
//       }
//     });

//     // Cleanup actor relationships when actors are deleted
//     Hooks.on('preDeleteActor', async (document, options, userId) => {
//       try {
//         await game.campaignCodex.cleanupActorRelationships(document);
//       } catch (error) {
//         console.warn(`Campaign Codex | Actor cleanup failed for ${document.name}:`, error);
//       }
//     });
//   }
// }