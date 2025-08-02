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
              linkedScene: null,  // Add this
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
              linkedScene: null,  // Add this
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
              linkedScene: null,  // Add this
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

async linkSceneToDocument(scene, document) {
  if (!scene || !document) return;
  
  const docData = document.getFlag("campaign-codex", "data") || {};
  docData.linkedScene = scene.uuid;
  await document.setFlag("campaign-codex", "data", docData);
}

async linkLocationToShop(locationDoc, shopDoc) {
  // Prevent self-linking
  if (locationDoc.uuid === shopDoc.uuid) return;
  
  // Get the shop's current data
  const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
  const oldLocation = shopData.linkedLocation;
  
  // If the shop already has a location, remove it from that location first
  if (oldLocation && oldLocation !== locationDoc.uuid) {
    const oldLocationDoc = await fromUuid(oldLocation);
    if (oldLocationDoc) {
      const oldLocationData = oldLocationDoc.getFlag("campaign-codex", "data") || {};
      const linkedShops = oldLocationData.linkedShops || [];
      oldLocationData.linkedShops = linkedShops.filter(uuid => uuid !== shopDoc.uuid);
      await oldLocationDoc.setFlag("campaign-codex", "data", oldLocationData);
    }
  }
  
  // Add shop to new location
  const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
  const linkedShops = locationData.linkedShops || [];
  if (!linkedShops.includes(shopDoc.uuid)) {
    linkedShops.push(shopDoc.uuid);
    locationData.linkedShops = linkedShops;
    await locationDoc.setFlag("campaign-codex", "data", locationData);
  }

  // Set location for shop (single location per shop)
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

async handleRelationshipUpdates(document, changes, type) {
  console.log(document);
  console.log(changes);
  console.log(type);
  
  // Only proceed if a campaign-codex flag was involved at all.
  if (!foundry.utils.hasProperty(changes, "flags.campaign-codex")) return;

  // This now calls the correct handler without any other checks.
  switch (type) {
    case "location":
      await this._handleLocationUpdates(document);
      break;
    case "shop":
      await this._handleShopUpdates(document);
      break;
    case "npc":
      // NPC handler needs the 'changes' object for its multiple link types
      await this._handleNPCUpdates(document, changes.flags["campaign-codex"]?.data || {});
      break;
    case "region":
      await this._handleRegionUpdates(document);
      break;
  }
  
  // Refresh related sheets after all updates are complete.
  await this._scheduleSheetRefresh(document.uuid);
}


  async _scheduleSheetRefresh(changedDocUuid) {
  const sheetsToRefresh = new Set();

  for (const app of Object.values(ui.windows)) {
    if (!app.document?.getFlag) continue;
    
    // Check if the app is the one that changed
    if (app.document.uuid === changedDocUuid) {
      sheetsToRefresh.add(app);
      continue;
    }

    // Check if the app is related to the document that changed
    if (app._isRelatedDocument) {
      if (await app._isRelatedDocument(changedDocUuid)) {
        sheetsToRefresh.add(app);
      }
    }
  }
  
  // Now, render all unique sheets that were affected
  for (const app of sheetsToRefresh) {
    app.render(false);
  }
}

async _handleLocationUpdates(locationDoc) {
  const oldData = foundry.utils.getProperty(locationDoc._source, 'flags.campaign-codex.data') || {};
  const newData = foundry.utils.getProperty(locationDoc, 'flags.campaign-codex.data') || {};

  // --- Handle Shop Changes ---
  const oldShops = oldData.linkedShops || [];
  const newShops = newData.linkedShops || [];
  const addedShops = newShops.filter(uuid => !oldShops.includes(uuid));
  const removedShops = oldShops.filter(uuid => !newShops.includes(uuid));

  for (const shopUuid of removedShops) {
    const shopDoc = await fromUuid(shopUuid).catch(() => null);
    if (shopDoc) {
      await shopDoc.unsetFlag("campaign-codex", "data.linkedLocation");
    }
  }
  for (const shopUuid of addedShops) {
    const shopDoc = await fromUuid(shopUuid).catch(() => null);
    if (shopDoc) {
      const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
      shopData.linkedLocation = locationDoc.uuid;
      await shopDoc.setFlag("campaign-codex", "data", shopData);
    }
  }
  
  // --- Handle NPC Changes ---
  const oldNPCs = oldData.linkedNPCs || [];
  const newNPCs = newData.linkedNPCs || [];
  const addedNPCs = newNPCs.filter(uuid => !oldNPCs.includes(uuid));
  const removedNPCs = oldNPCs.filter(uuid => !newNPCs.includes(uuid));

  for (const npcUuid of removedNPCs) {
    const npcDoc = await fromUuid(npcUuid).catch(() => null);
    if (npcDoc) {
      const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
      npcData.linkedLocations = (npcData.linkedLocations || []).filter(uuid => uuid !== locationDoc.uuid);
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }
  for (const npcUuid of addedNPCs) {
    const npcDoc = await fromUuid(npcUuid).catch(() => null);
    if (npcDoc) {
      const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
      const locations = new Set(npcData.linkedLocations || []);
      locations.add(locationDoc.uuid);
      npcData.linkedLocations = [...locations];
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }
}



async _handleShopUpdates(shopDoc) {
  const oldData = foundry.utils.getProperty(shopDoc._source, 'flags.campaign-codex.data') || {};
  const newData = foundry.utils.getProperty(shopDoc, 'flags.campaign-codex.data') || {};

  // --- Handle Location Change ---
  const oldLocationUuid = oldData.linkedLocation;
  const newLocationUuid = newData.linkedLocation;

  if (oldLocationUuid !== newLocationUuid) {
    if (oldLocationUuid) {
      const oldLocationDoc = await fromUuid(oldLocationUuid).catch(() => null);
      if (oldLocationDoc) {
        const data = oldLocationDoc.getFlag("campaign-codex", "data") || {};
        data.linkedShops = (data.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
        await oldLocationDoc.setFlag("campaign-codex", "data", data);
      }
    }
    if (newLocationUuid) {
      const newLocationDoc = await fromUuid(newLocationUuid).catch(() => null);
      if (newLocationDoc) {
        const data = newLocationDoc.getFlag("campaign-codex", "data") || {};
        const shops = new Set(data.linkedShops || []);
        shops.add(shopDoc.uuid);
        data.linkedShops = [...shops];
        await newLocationDoc.setFlag("campaign-codex", "data", data);
      }
    }
  }

  // --- Handle NPC Changes ---
  const oldNPCs = oldData.linkedNPCs || [];
  const newNPCs = newData.linkedNPCs || [];
  const addedNPCs = newNPCs.filter(uuid => !oldNPCs.includes(uuid));
  const removedNPCs = oldNPCs.filter(uuid => !newNPCs.includes(uuid));

  for (const npcUuid of removedNPCs) {
    const npcDoc = await fromUuid(npcUuid).catch(() => null);
    if (npcDoc) {
      const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
      npcData.linkedShops = (npcData.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }
  for (const npcUuid of addedNPCs) {
    const npcDoc = await fromUuid(npcUuid).catch(() => null);
    if (npcDoc) {
      const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
      const shops = new Set(npcData.linkedShops || []);
      shops.add(shopDoc.uuid);
      npcData.linkedShops = [...shops];
      await npcDoc.setFlag("campaign-codex", "data", npcData);
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


if (changes.linkedShops) {
  const oldShops = oldData.linkedShops || [];
  const newShops = newData.linkedShops || [];
  
  // Create an array of promises for all removal operations
  const removalPromises = oldShops
    .filter(shopUuid => !newShops.includes(shopUuid))
    .map(async shopUuid => {
      const shopDoc = await fromUuid(shopUuid);
      if (shopDoc) {
        const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
        shopData.linkedNPCs = (shopData.linkedNPCs || []).filter(uuid => uuid !== npcDoc.uuid);
        return shopDoc.setFlag("campaign-codex", "data", shopData);
      }
    });

  // Create an array of promises for all addition operations
  const additionPromises = newShops
    .filter(shopUuid => !oldShops.includes(shopUuid))
    .map(async shopUuid => {
      const shopDoc = await fromUuid(shopUuid);
      if (shopDoc) {
        const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
        const linkedNPCs = shopData.linkedNPCs || [];
        if (!linkedNPCs.includes(npcDoc.uuid)) {
          linkedNPCs.push(npcDoc.uuid);
          shopData.linkedNPCs = linkedNPCs;
          return shopDoc.setFlag("campaign-codex", "data", shopData);
        }
      }
    });

  // Wait for all the updates to complete
  await Promise.all([...removalPromises, ...additionPromises]);

  // Now that all data is saved, refresh the NPC sheet if it's open
  for (const app of Object.values(ui.windows)) {
    if (app.document?.uuid === npcDoc.uuid) {
      app.render(false);
      break;
    }
  }
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
    
    // Refresh the region sheet and all affected location sheets immediately
    for (const app of Object.values(ui.windows)) {
      if (!app.document?.getFlag) continue;
      
      const appDocUuid = app.document.uuid;
      const appType = app.document.getFlag("campaign-codex", "type");
      
      // Refresh if it's the region sheet or any affected location sheet
      if (appDocUuid === regionDoc.uuid || 
         (appType === "location" && allAffectedLocations.includes(appDocUuid))) {
        app.render(false);
      }
    }
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


async createGroupJournal(name = "New Group Overview") {
  const creationKey = `group-${name}`;
  if (this._creationQueue.has(creationKey)) return;
  this._creationQueue.add(creationKey);

  try {
    const journalData = {
      name: name,
      flags: {
        "campaign-codex": {
          type: "group",
          data: {
            description: "",
            members: [], // Array of UUIDs for group members
            notes: ""
          }
        },
        "core": {
          sheetClass: "campaign-codex.GroupSheet"
        }
      },
      pages: [{
        name: "Overview",
        type: "text",
        text: { content: `<h1>${name}</h1><p>Group overview...</p>` }
      }]
    };

    const journal = await JournalEntry.create(journalData);
    return journal;
  } finally {
    this._creationQueue.delete(creationKey);
  }
}



}