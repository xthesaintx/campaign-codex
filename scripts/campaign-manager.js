export class CampaignManager {
  constructor() {
    this.relationshipCache = new Map();
    this._creationQueue = new Set(); // Prevent duplicate creation
  }

  getActorDisplayMeta(actor) {
    if (!actor) return '<span class="entity-type">NPC</span>';
    if (actor.type === 'character') return '<span class="entity-type-player">PLAYER</span>';
    return '<span class="entity-type">NPC</span>';
  }

  // === JOURNAL CREATION METHODS ===

  async createLocationJournal(name = "New Location") {
    // Prevent duplicate creation
    const creationKey = `location-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "location",
            data: {
              description: "",
              linkedNPCs: [],
              linkedShops: [],
              notes: ""
            }
          },
          "core": {
            sheetClass: "campaign-codex.LocationSheet"
          }
        },
        pages: [{
          name: "Overview",
          type: "text",
          text: { content: `<h1>${name}</h1><p>Location overview...</p>` }
        }]
      };

      const journal = await JournalEntry.create(journalData);
      return journal;
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }


async findOrCreateNPCJournalForActor(actor) {
  if (!actor) return null;

  // First, check if a journal already exists for this actor
  let npcJournal = game.journal.find(j => {
    const journalData = j.getFlag("campaign-codex", "data");
    // Ensure we check for the correct type and a matching linkedActor UUID
    return j.getFlag("campaign-codex", "type") === "npc" && journalData?.linkedActor === actor.uuid;
  });

  // If no journal exists, create one
  if (!npcJournal) {
    npcJournal = await this.createNPCJournal(actor);
    ui.notifications.info(`Created NPC journal for "${actor.name}"`);
  }

  return npcJournal;
}


  async createShopJournal(name = "New Entry") {
    const creationKey = `shop-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "shop",
            data: {
              description: "",
              linkedNPCs: [],
              linkedLocation: null,
              inventory: [],
              markup: 1.0,
              notes: ""
            }
          },
          "core": {
            sheetClass: "campaign-codex.ShopSheet"
          }
        },
        pages: [{
          name: "Overview",
          type: "text",
          text: { content: `<h1>${name}</h1><p>Entry overview...</p>` }
        }]
      };

      const journal = await JournalEntry.create(journalData);
      return journal;
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

// In campaign-manager.js

async createNPCJournal(actor = null, name = null) {
  const journalName = name || (actor ? `${actor.name} - Journal` : "New NPC Journal");
  const creationKey = `npc-${actor?.uuid || journalName}`;

  if (this._creationQueue.has(creationKey)) return;
  this._creationQueue.add(creationKey);

  try {
    // The redundant check for an existing journal has been removed from here.
    // The calling function is now responsible for that check.

    const journalData = {
      name: journalName,
      flags: {
        "campaign-codex": {
          type: "npc",
          data: {
            linkedActor: actor ? actor.uuid : null,
            description: "",
            linkedLocations: [],
            linkedShops: [],
            associates: [],
            notes: ""
          }
        },
        "core": {
          sheetClass: "campaign-codex.NPCSheet"
        }
      },
      pages: [{
        name: "Overview",
        type: "text",
        text: { content: `<h1>${journalName}</h1><p>NPC details...</p>` }
      }]
    };

    const journal = await JournalEntry.create(journalData);
    return journal;
  } finally {
    this._creationQueue.delete(creationKey);
  }
}

  async createRegionJournal(name = "New Region") {
    const creationKey = `region-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "region",
            data: {
              description: "",
              linkedLocations: [],
              notes: ""
            }
          },
          "core": {
            sheetClass: "campaign-codex.RegionSheet"
          }
        },
        pages: [{
          name: "Overview",
          type: "text",
          text: { content: `<h1>${name}</h1><p>Region overview...</p>` }
        }]
      };

      const journal = await JournalEntry.create(journalData);
      return journal;
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

  // === CONVERSION METHODS ===

  async convertToLocation(journal) {
    await journal.setFlag("campaign-codex", "type", "location");
    await journal.setFlag("campaign-codex", "data", {
      description: "",
      linkedNPCs: [],
      linkedShops: [],
      notes: ""
    });
    await journal.setFlag("core", "sheetClass", "campaign-codex.LocationSheet");
    
    journal.sheet.close();
    setTimeout(() => {
      const LocationSheet = CONFIG.JournalEntry.sheetClasses["campaign-codex.LocationSheet"];
      if (LocationSheet) {
        const sheet = new LocationSheet.cls(journal);
        sheet.render(true);
      }
    }, 100);
  }

  async convertToShop(journal) {
    await journal.setFlag("campaign-codex", "type", "shop");
    await journal.setFlag("campaign-codex", "data", {
      description: "",
      linkedNPCs: [],
      linkedLocation: null,
      inventory: [],
      markup: 1.0,
      notes: ""
    });
    await journal.setFlag("core", "sheetClass", "campaign-codex.ShopSheet");
    
    journal.sheet.close();
    setTimeout(() => {
      const ShopSheet = CONFIG.JournalEntry.sheetClasses["campaign-codex.ShopSheet"];
      if (ShopSheet) {
        const sheet = new ShopSheet.cls(journal);
        sheet.render(true);
      }
    }, 100);
  }

  async convertToNPC(journal) {
    await journal.setFlag("campaign-codex", "type", "npc");
    await journal.setFlag("campaign-codex", "data", {
      linkedActor: null,
      description: "",
      linkedLocations: [],
      linkedShops: [],
      associates: [],
      notes: ""
    });
    await journal.setFlag("core", "sheetClass", "campaign-codex.NPCSheet");
    
    journal.sheet.close();
    setTimeout(() => {
      const NPCSheet = CONFIG.JournalEntry.sheetClasses["campaign-codex.NPCSheet"];
      if (NPCSheet) {
        const sheet = new NPCSheet.cls(journal);
        sheet.render(true);
      }
    }, 100);
  }

  async convertToRegion(journal) {
    await journal.setFlag("campaign-codex", "type", "region");
    await journal.setFlag("campaign-codex", "data", {
      description: "",
      linkedLocations: [],
      notes: ""
    });
    await journal.setFlag("core", "sheetClass", "campaign-codex.RegionSheet");
    
    journal.sheet.close();
    setTimeout(() => {
      const RegionSheet = CONFIG.JournalEntry.sheetClasses["campaign-codex.RegionSheet"];
      if (RegionSheet) {
        const sheet = new RegionSheet.cls(journal);
        sheet.render(true);
      }
    }, 100);
  }

  // === RELATIONSHIP MANAGEMENT ===

  async linkLocationToNPC(locationDoc, npcDoc) {
    // Prevent self-linking
    if (locationDoc.uuid === npcDoc.uuid) return;
    
    // Add NPC to location
    const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    const linkedNPCs = locationData.linkedNPCs || [];
    if (!linkedNPCs.includes(npcDoc.uuid)) {
      linkedNPCs.push(npcDoc.uuid);
      locationData.linkedNPCs = linkedNPCs;
      await locationDoc.setFlag("campaign-codex", "data", locationData);
    }

    // Add location to NPC
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const linkedLocations = npcData.linkedLocations || [];
    if (!linkedLocations.includes(locationDoc.uuid)) {
      linkedLocations.push(locationDoc.uuid);
      npcData.linkedLocations = linkedLocations;
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }

  async linkLocationToShop(locationDoc, shopDoc) {
    // Prevent self-linking
    if (locationDoc.uuid === shopDoc.uuid) return;
    
    // Add shop to location
    const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    const linkedShops = locationData.linkedShops || [];
    if (!linkedShops.includes(shopDoc.uuid)) {
      linkedShops.push(shopDoc.uuid);
      locationData.linkedShops = linkedShops;
      await locationDoc.setFlag("campaign-codex", "data", locationData);
    }

    // Set location for shop (single location per shop)
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    shopData.linkedLocation = locationDoc.uuid;
    await shopDoc.setFlag("campaign-codex", "data", shopData);
  }

  async linkShopToNPC(shopDoc, npcDoc) {
    // Prevent self-linking
    if (shopDoc.uuid === npcDoc.uuid) return;
    
    // Add NPC to shop
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    const linkedNPCs = shopData.linkedNPCs || [];
    if (!linkedNPCs.includes(npcDoc.uuid)) {
      linkedNPCs.push(npcDoc.uuid);
      shopData.linkedNPCs = linkedNPCs;
      await shopDoc.setFlag("campaign-codex", "data", shopData);
    }

    // Add shop to NPC
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const linkedShops = npcData.linkedShops || [];
    if (!linkedShops.includes(shopDoc.uuid)) {
      linkedShops.push(shopDoc.uuid);
      npcData.linkedShops = linkedShops;
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }

  async linkNPCToNPC(npc1Doc, npc2Doc) {
    // Prevent self-linking
    if (npc1Doc.uuid === npc2Doc.uuid) return;
    
    // Add NPC2 to NPC1's associates
    const npc1Data = npc1Doc.getFlag("campaign-codex", "data") || {};
    const associates1 = npc1Data.associates || [];
    if (!associates1.includes(npc2Doc.uuid)) {
      associates1.push(npc2Doc.uuid);
      npc1Data.associates = associates1;
      await npc1Doc.setFlag("campaign-codex", "data", npc1Data);
    }

    // Add NPC1 to NPC2's associates
    const npc2Data = npc2Doc.getFlag("campaign-codex", "data") || {};
    const associates2 = npc2Data.associates || [];
    if (!associates2.includes(npc1Doc.uuid)) {
      associates2.push(npc1Doc.uuid);
      npc2Data.associates = associates2;
      await npc2Doc.setFlag("campaign-codex", "data", npc2Data);
    }
  }

async linkRegionToLocation(regionDoc, locationDoc) {
  if (regionDoc.uuid === locationDoc.uuid) return;
  
  // First, remove the location from any other regions
  const allRegions = game.journal.filter(j => j.getFlag("campaign-codex", "type") === "region");
  for (const region of allRegions) {
    if (region.uuid === regionDoc.uuid) continue;
    
    const regionData = region.getFlag("campaign-codex", "data") || {};
    const linkedLocations = regionData.linkedLocations || [];
    
    if (linkedLocations.includes(locationDoc.uuid)) {
      regionData.linkedLocations = linkedLocations.filter(uuid => uuid !== locationDoc.uuid);
      await region.setFlag("campaign-codex", "data", regionData);
    }
  }
  
  // --- Step 1: Add location to the target region's list (one-way) ---
  const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
  const linkedLocations = regionData.linkedLocations || [];
  if (!linkedLocations.includes(locationDoc.uuid)) {
    linkedLocations.push(locationDoc.uuid);
    regionData.linkedLocations = linkedLocations;
    await regionDoc.setFlag("campaign-codex", "data", regionData);
  }

  // --- Step 2: Add region's UUID to the location document (two-way) ---
  const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
  locationData.parentRegion = regionDoc.uuid;
  await locationDoc.setFlag("campaign-codex", "data", locationData);
  
  // --- Step 3: Refresh UI for both documents ---
  for (const app of Object.values(ui.windows)) {
    if (app.document && (app.document.uuid === regionDoc.uuid || app.document.uuid === locationDoc.uuid)) {
      app.render(false);
    }
  }
}


  // === ITEM MANAGEMENT ===

async addItemToShop(shopDoc, itemDoc, quantity = 1) {
  const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
  const inventory = shopData.inventory || [];
  
  // Check if item already exists
  const existingItem = inventory.find(i => i.itemUuid === itemDoc.uuid);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    inventory.push({
      itemUuid: itemDoc.uuid, // Store UUID directly, no need to import
      quantity: quantity,
      customPrice: null // null means use item's base price + markup
    });
  }
  
  shopData.inventory = inventory;
  await shopDoc.setFlag("campaign-codex", "data", shopData);
}

  // === UPDATE HANDLERS ===
  async handleRelationshipUpdates(document, changes, type) {
    // This handles cascading updates when relationships change
    const flagChanges = changes.flags?.["campaign-codex"]?.data;
    if (!flagChanges) return;

    // Debounce to prevent infinite loops
    if (this._updating) return;
    this._updating = true;

    try {
      switch (type) {
        case "location":
          await this._handleLocationUpdates(document, flagChanges);
          break;
        case "shop":
          await this._handleShopUpdates(document, flagChanges);
          break;
        case "npc":
          await this._handleNPCUpdates(document, flagChanges);
          break;
        case "region":
          await this._handleRegionUpdates(document, flagChanges);
          break;
      }
      
      // Force refresh of related sheets after updates
      this._scheduleSheetRefresh(document.uuid);
      
    } catch (error) {
      console.error(`Campaign Codex | Error handling relationship updates:`, error);
    } finally {
      this._updating = false;
    }
  }

  // Add this new method to schedule sheet refreshes
  _scheduleSheetRefresh(changedDocUuid) {
    setTimeout(() => {
      for (const app of Object.values(ui.windows)) {
        if (!app.document || !app.document.getFlag) continue;
        
        const appType = app.document.getFlag("campaign-codex", "type");
        if (!appType) continue;
        
        // Check if this sheet should be refreshed
        const shouldRefresh = app.document.uuid === changedDocUuid || 
                            (app._isRelatedDocument && app._isRelatedDocument(changedDocUuid));
        
        if (shouldRefresh) {
          app.render(false);
        }
      }
    }, 100);
  }

  async _handleLocationUpdates(locationDoc, changes) {
    const oldData = foundry.utils.getProperty(locationDoc._source, 'flags.campaign-codex.data') || {};
    const newData = foundry.utils.getProperty(locationDoc, 'flags.campaign-codex.data') || {};

    // Handle NPC changes
    if (changes.linkedNPCs) {
      const oldNPCs = oldData.linkedNPCs || [];
      const newNPCs = newData.linkedNPCs || [];
      
      // Remove from old NPCs
      for (const npcUuid of oldNPCs) {
        if (!newNPCs.includes(npcUuid)) {
          const npcDoc = await fromUuid(npcUuid);
          if (npcDoc) {
            const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
            const linkedLocations = npcData.linkedLocations || [];
            npcData.linkedLocations = linkedLocations.filter(uuid => uuid !== locationDoc.uuid);
            await npcDoc.setFlag("campaign-codex", "data", npcData);
          }
        }
      }
      
      // Add to new NPCs
      for (const npcUuid of newNPCs) {
        if (!oldNPCs.includes(npcUuid)) {
          const npcDoc = await fromUuid(npcUuid);
          if (npcDoc) {
            const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
            const linkedLocations = npcData.linkedLocations || [];
            if (!linkedLocations.includes(locationDoc.uuid)) {
              linkedLocations.push(locationDoc.uuid);
              npcData.linkedLocations = linkedLocations;
              await npcDoc.setFlag("campaign-codex", "data", npcData);
            }
          }
        }
      }
    }

    // Handle shop changes
    if (changes.linkedShops) {
      const oldShops = oldData.linkedShops || [];
      const newShops = newData.linkedShops || [];
      
      // Remove from old shops
      for (const shopUuid of oldShops) {
        if (!newShops.includes(shopUuid)) {
          const shopDoc = await fromUuid(shopUuid);
          if (shopDoc) {
            const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
            shopData.linkedLocation = null;
            await shopDoc.setFlag("campaign-codex", "data", shopData);
          }
        }
      }
      
      // Add to new shops
      for (const shopUuid of newShops) {
        if (!oldShops.includes(shopUuid)) {
          const shopDoc = await fromUuid(shopUuid);
          if (shopDoc) {
            const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
            shopData.linkedLocation = locationDoc.uuid;
            await shopDoc.setFlag("campaign-codex", "data", shopData);
          }
        }
      }
    }
  }

  async _handleShopUpdates(shopDoc, changes) {
    const oldData = foundry.utils.getProperty(shopDoc._source, 'flags.campaign-codex.data') || {};
    const newData = foundry.utils.getProperty(shopDoc, 'flags.campaign-codex.data') || {};

    // Handle NPC changes
    if (changes.linkedNPCs) {
      const oldNPCs = oldData.linkedNPCs || [];
      const newNPCs = newData.linkedNPCs || [];
      
      // Remove from old NPCs
      for (const npcUuid of oldNPCs) {
        if (!newNPCs.includes(npcUuid)) {
          const npcDoc = await fromUuid(npcUuid);
          if (npcDoc) {
            const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
            const linkedShops = npcData.linkedShops || [];
            npcData.linkedShops = linkedShops.filter(uuid => uuid !== shopDoc.uuid);
            await npcDoc.setFlag("campaign-codex", "data", npcData);
          }
        }
      }
      
      // Add to new NPCs
      for (const npcUuid of newNPCs) {
        if (!oldNPCs.includes(npcUuid)) {
          const npcDoc = await fromUuid(npcUuid);
          if (npcDoc) {
            const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
            const linkedShops = npcData.linkedShops || [];
            if (!linkedShops.includes(shopDoc.uuid)) {
              linkedShops.push(shopDoc.uuid);
              npcData.linkedShops = linkedShops;
              await npcDoc.setFlag("campaign-codex", "data", npcData);
            }
          }
        }
      }
    }

    // Handle location changes
    if (changes.linkedLocation !== undefined) {
      const oldLocation = oldData.linkedLocation;
      const newLocation = newData.linkedLocation;
      
      // Remove from old location
      if (oldLocation && oldLocation !== newLocation) {
        const locationDoc = await fromUuid(oldLocation);
        if (locationDoc) {
          const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
          const linkedShops = locationData.linkedShops || [];
          locationData.linkedShops = linkedShops.filter(uuid => uuid !== shopDoc.uuid);
          await locationDoc.setFlag("campaign-codex", "data", locationData);
        }
      }
      
      // Add to new location
      if (newLocation && newLocation !== oldLocation) {
        const locationDoc = await fromUuid(newLocation);
        if (locationDoc) {
          const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
          const linkedShops = locationData.linkedShops || [];
          if (!linkedShops.includes(shopDoc.uuid)) {
            linkedShops.push(shopDoc.uuid);
            locationData.linkedShops = linkedShops;
            await locationDoc.setFlag("campaign-codex", "data", locationData);
          }
        }
      }
    }
  }

  async _handleNPCUpdates(npcDoc, changes) {
    const oldData = foundry.utils.getProperty(npcDoc._source, 'flags.campaign-codex.data') || {};
    const newData = foundry.utils.getProperty(npcDoc, 'flags.campaign-codex.data') || {};

    // Handle location changes
    if (changes.linkedLocations) {
      const oldLocations = oldData.linkedLocations || [];
      const newLocations = newData.linkedLocations || [];
      
      // Remove from old locations
      for (const locationUuid of oldLocations) {
        if (!newLocations.includes(locationUuid)) {
          const locationDoc = await fromUuid(locationUuid);
          if (locationDoc) {
            const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
            const linkedNPCs = locationData.linkedNPCs || [];
            locationData.linkedNPCs = linkedNPCs.filter(uuid => uuid !== npcDoc.uuid);
            await locationDoc.setFlag("campaign-codex", "data", locationData);
          }
        }
      }
      
      // Add to new locations
      for (const locationUuid of newLocations) {
        if (!oldLocations.includes(locationUuid)) {
          const locationDoc = await fromUuid(locationUuid);
          if (locationDoc) {
            const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
            const linkedNPCs = locationData.linkedNPCs || [];
            if (!linkedNPCs.includes(npcDoc.uuid)) {
              linkedNPCs.push(npcDoc.uuid);
              locationData.linkedNPCs = linkedNPCs;
              await locationDoc.setFlag("campaign-codex", "data", locationData);
            }
          }
        }
      }
    }

    // Handle shop changes - THIS IS THE KEY FIX
    if (changes.linkedShops) {
      const oldShops = oldData.linkedShops || [];
      const newShops = newData.linkedShops || [];
      
      // Remove from old shops
      for (const shopUuid of oldShops) {
        if (!newShops.includes(shopUuid)) {
          const shopDoc = await fromUuid(shopUuid);
          if (shopDoc) {
            const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
            shopData.linkedNPCs = (shopData.linkedNPCs || []).filter(uuid => uuid !== npcDoc.uuid);
            await shopDoc.setFlag("campaign-codex", "data", shopData);
          }
        }
      }
      
      // Add to new shops
      for (const shopUuid of newShops) {
        if (!oldShops.includes(shopUuid)) {
          const shopDoc = await fromUuid(shopUuid);
          if (shopDoc) {
            const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
            const linkedNPCs = shopData.linkedNPCs || [];
            if (!linkedNPCs.includes(npcDoc.uuid)) {
              linkedNPCs.push(npcDoc.uuid);
              shopData.linkedNPCs = linkedNPCs;
              await shopDoc.setFlag("campaign-codex", "data", shopData);
            }
          }
        }
      }
      
      // CRITICAL: Force refresh of NPC sheet to update auto-discovered locations
      // This will cause the NPC sheet to re-calculate its locations, removing shop-based ones
      setTimeout(() => {
        for (const app of Object.values(ui.windows)) {
          if (app.document && app.document.uuid === npcDoc.uuid) {
            app.render(false);
            break;
          }
        }
      }, 200);
    }

    // Handle associate changes - FIXED BIDIRECTIONAL LOGIC
    if (changes.associates) {
      const oldAssociates = oldData.associates || [];
      const newAssociates = newData.associates || [];
      
      // Remove from old associates
      for (const associateUuid of oldAssociates) {
        if (!newAssociates.includes(associateUuid)) {
          const associateDoc = await fromUuid(associateUuid);
          if (associateDoc && !associateDoc._pendingDeletion) {
            const associateData = associateDoc.getFlag("campaign-codex", "data") || {};
            const associates = associateData.associates || [];
            
            // Remove this NPC from the associate's list
            const updatedAssociates = associates.filter(uuid => uuid !== npcDoc.uuid);
            if (updatedAssociates.length !== associates.length) {
              associateData.associates = updatedAssociates;
              await associateDoc.setFlag("campaign-codex", "data", associateData);
            }
          }
        }
      }
      
      // Add to new associates
      for (const associateUuid of newAssociates) {
        if (!oldAssociates.includes(associateUuid)) {
          const associateDoc = await fromUuid(associateUuid);
          if (associateDoc && !associateDoc._pendingDeletion) {
            const associateData = associateDoc.getFlag("campaign-codex", "data") || {};
            const associates = associateData.associates || [];
            
            // Add this NPC to the associate's list if not already present
            if (!associates.includes(npcDoc.uuid)) {
              associates.push(npcDoc.uuid);
              associateData.associates = associates;
              await associateDoc.setFlag("campaign-codex", "data", associateData);
            }
          }
        }
      }
    }
  }

  async _handleRegionUpdates(regionDoc, changes) {
    // Force refresh any affected location sheets when region relationships change
    if (changes.linkedLocations) {
      const oldData = foundry.utils.getProperty(regionDoc._source, 'flags.campaign-codex.data') || {};
      const newData = foundry.utils.getProperty(regionDoc, 'flags.campaign-codex.data') || {};
      
      const oldLocations = oldData.linkedLocations || [];
      const newLocations = newData.linkedLocations || [];
      
      // Get all affected location UUIDs (both added and removed)
      const allAffectedLocations = [...new Set([...oldLocations, ...newLocations])];
      
      // Force refresh of the region sheet and all affected location sheets
      setTimeout(() => {
        for (const app of Object.values(ui.windows)) {
          if (!app.document || !app.document.getFlag) continue;
          
          const appDocUuid = app.document.uuid;
          const appType = app.document.getFlag("campaign-codex", "type");
          
          // Refresh if it's the region sheet or any affected location sheet
          if (appDocUuid === regionDoc.uuid || 
              (appType === "location" && allAffectedLocations.includes(appDocUuid))) {
            app.render(false);
          }
        }
      }, 150);
    }
  }

  // === CLEANUP METHODS ===

  async cleanupRelationships(document, type) {
    const data = document.getFlag("campaign-codex", "data") || {};

    switch (type) {
      case "location":
        // Remove this location from all linked NPCs and shops
        for (const npcUuid of data.linkedNPCs || []) {
          const npcDoc = await fromUuid(npcUuid);
          if (npcDoc) {
            const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
            npcData.linkedLocations = (npcData.linkedLocations || []).filter(uuid => uuid !== document.uuid);
            await npcDoc.setFlag("campaign-codex", "data", npcData);
          }
        }
        
        for (const shopUuid of data.linkedShops || []) {
          const shopDoc = await fromUuid(shopUuid);
          if (shopDoc) {
            const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
            shopData.linkedLocation = null;
            await shopDoc.setFlag("campaign-codex", "data", shopData);
          }
        }
        break;

      case "shop":
        // Remove this shop from all linked NPCs and location
        for (const npcUuid of data.linkedNPCs || []) {
          const npcDoc = await fromUuid(npcUuid);
          if (npcDoc) {
            const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
            npcData.linkedShops = (npcData.linkedShops || []).filter(uuid => uuid !== document.uuid);
            await npcDoc.setFlag("campaign-codex", "data", npcData);
          }
        }
        
        if (data.linkedLocation) {
          const locationDoc = await fromUuid(data.linkedLocation);
          if (locationDoc) {
            const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
            locationData.linkedShops = (locationData.linkedShops || []).filter(uuid => uuid !== document.uuid);
            await locationDoc.setFlag("campaign-codex", "data", locationData);
          }
        }
        break;

      case "npc":
        // Remove this NPC from all linked locations, shops, and associates
        for (const locationUuid of data.linkedLocations || []) {
          const locationDoc = await fromUuid(locationUuid);
          if (locationDoc) {
            const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
            locationData.linkedNPCs = (locationData.linkedNPCs || []).filter(uuid => uuid !== document.uuid);
            await locationDoc.setFlag("campaign-codex", "data", locationData);
          }
        }
        
        for (const shopUuid of data.linkedShops || []) {
          const shopDoc = await fromUuid(shopUuid);
          if (shopDoc) {
            const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
            shopData.linkedNPCs = (shopData.linkedNPCs || []).filter(uuid => uuid !== document.uuid);
            await shopDoc.setFlag("campaign-codex", "data", shopData);
          }
        }
        
        for (const associateUuid of data.associates || []) {
          const associateDoc = await fromUuid(associateUuid);
          if (associateDoc) {
            const associateData = associateDoc.getFlag("campaign-codex", "data") || {};
            associateData.associates = (associateData.associates || []).filter(uuid => uuid !== document.uuid);
            await associateDoc.setFlag("campaign-codex", "data", associateData);
          }
        }
        break;

      case "region":
        // Regions don't need cleanup as they don't create bidirectional relationships
        break;
    }
  }

  async cleanupActorRelationships(actorDoc) {
    // Remove this actor from all NPC journals that link to it
    const npcJournals = game.journal.filter(j => {
      const data = j.getFlag("campaign-codex", "data");
      return data && data.linkedActor === actorDoc.uuid;
    });

    for (const journal of npcJournals) {
      const data = journal.getFlag("campaign-codex", "data") || {};
      data.linkedActor = null;
      await journal.setFlag("campaign-codex", "data", data);
    }
  }

  // === UTILITY METHODS ===

  async getLinkedDocuments(sourceDoc, linkType) {
    const data = sourceDoc.getFlag("campaign-codex", "data") || {};
    const linkedIds = data[linkType] || [];
    
    if (linkType === 'linkedActor') {
      if (!linkedIds) return [];
      const actor = await fromUuid(linkedIds);
      return actor ? [actor] : [];
    }
    
    // For arrays of UUIDs
    const documents = [];
    for (const uuid of Array.isArray(linkedIds) ? linkedIds : [linkedIds]) {
      if (uuid) {
        const doc = await fromUuid(uuid);
        if (doc) documents.push(doc);
      }
    }
    return documents;
  }

  async refreshAllSheets(documentUuid) {
    // Refresh all open sheets that might be affected by relationship changes
    for (const app of Object.values(ui.windows)) {
      if (app.document && (app.document.uuid === documentUuid || 
          await this._isRelatedDocument(app.document, documentUuid))) {
        app.render(false);
      }
    }
  }

  async _isRelatedDocument(doc, changedDocUuid) {
    if (!doc.getFlag) return false;
    
    const data = doc.getFlag("campaign-codex", "data") || {};
    const allLinkedUuids = [
      ...(data.linkedNPCs || []),
      ...(data.linkedShops || []),
      ...(data.linkedLocations || []),
      ...(data.associates || []),
      data.linkedLocation,
      data.linkedActor
    ].filter(Boolean);
    
    return allLinkedUuids.includes(changedDocUuid);
  }
}