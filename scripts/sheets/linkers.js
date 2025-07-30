// Campaign Codex Linkers - Handles all document linking and relationship resolution
export class CampaignCodexLinkers {

  /**
   * Clear broken references from a document
   * @param {Document} document - The document to clean
   * @param {Array} brokenUuids - Array of broken reference UUIDs
   * @param {string} fieldName - The field name to clean (e.g., 'linkedLocations', 'linkedNPCs')
   */
  static async clearBrokenReferences(document, brokenUuids, fieldName) {
    if (!brokenUuids || brokenUuids.length === 0) return;
    
    try {
      //console.log (`Campaign Codex | Clearing ${brokenUuids.length} broken ${fieldName} references`);
      
      const currentData = document.getFlag("campaign-codex", "data") || {};
      const currentArray = currentData[fieldName] || [];
      
      // Remove broken UUIDs from the array
      const cleanedArray = currentArray.filter(uuid => !brokenUuids.includes(uuid));
      
      if (cleanedArray.length !== currentArray.length) {
        currentData[fieldName] = cleanedArray;
        await document.setFlag("campaign-codex", "data", currentData);
        
        const removedCount = currentArray.length - cleanedArray.length;
        //console.log (`Campaign Codex | Removed ${removedCount} broken ${fieldName} references from ${document.name}`);
        ui.notifications.warn(`Removed ${removedCount} broken ${fieldName} references from ${document.name}`);
      }
    } catch (error) {
      console.error(`Campaign Codex | Error clearing broken ${fieldName} references:`, error);
    }
  }

  // ===========================================
  // LOCATION METHODS
  // ===========================================

 /**
 * Get all locations for an NPC (direct + shop-discovered)
 */
static async getAllLocations(document, directLocationUuids) {
  if (!directLocationUuids || !Array.isArray(directLocationUuids)) return [];
  
  //console.log ("Processing direct location UUIDs:", directLocationUuids);
  const locationMap = new Map();
  const brokenLocationUuids = [];
  const brokenShopUuids = [];
  try {
    // First, add directly linked locations
    for (const uuid of directLocationUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Linked location not found: ${uuid}`);
          brokenLocationUuids.push(uuid);
          continue;
        }
        
        const imageData = journal.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";
        locationMap.set(journal.id, {
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          source: 'direct',
          meta: '<span class="entity-type">Direct Link</span>'
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${uuid}:`, error);
        brokenLocationUuids.push(uuid);
      }
    }
    
    // Clear broken references if any were found
    if (brokenLocationUuids.length > 0) {
      await this.clearBrokenReferences(document, brokenLocationUuids, 'linkedLocations');
    }
    
    // Then, discover locations through shop associations
    const npcId = document.id;
    const npcData = document.getFlag("campaign-codex", "data") || {};
    const npcLinkedShopUuids = npcData.linkedShops || [];
    
    //console.log (`Campaign Codex | NPC ${document.name} is linked to shops:`, npcLinkedShopUuids);
    
    try {
      // Only check shops that this NPC is actually linked to
      for (const shopUuid of npcLinkedShopUuids) {
        try {
          const shop = await fromUuid(shopUuid);
          if (!shop) {
            console.warn(`Campaign Codex | Shop not found: ${shopUuid}`);
            continue;
          }
          
          const shopData = shop.getFlag("campaign-codex", "data") || {};
          const linkedNPCUuids = shopData.linkedNPCs || [];
          
          // Double-check that this NPC is actually linked to this shop
          if (linkedNPCUuids.includes(document.uuid)) {
            // Find the location that contains this shop
            const shopLocationUuid = shopData.linkedLocation;
            
            if (shopLocationUuid) {
              const location = await fromUuid(shopLocationUuid);
              if (location) {
                // Verify that the location actually links to this shop
                const locationData = location.getFlag("campaign-codex", "data") || {};
                const locationShopUuids = locationData.linkedShops || [];
                
                if (locationShopUuids.includes(shop.uuid)) {
                  if (!locationMap.has(location.id)) {
                    locationMap.set(location.id, {
                      id: location.id,
                      uuid: location.uuid,
                      name: location.name,
                      img: location.getFlag("campaign-codex", "image") || "icons/svg/direction.svg",
                      source: 'shop',
                      shops: [shop.name],
                      meta: `<span class="entity-type">Via ${shop.name}</span>`
                    });
                    //console.log (`Campaign Codex | Added shop-based location ${location.name} via shop ${shop.name}`);
                  } else {
                    // Location already exists, add shop to the list
                    const existingLocation = locationMap.get(location.id);
                    if (existingLocation.source === 'shop') {
                      if (!existingLocation.shops.includes(shop.name)) {
                        existingLocation.shops.push(shop.name);
                        existingLocation.meta = `<span class="entity-type">Via ${existingLocation.shops.join(', ')}</span>`;
                      }
                    }
                  }
                }
              }
            }
          } else {
            console.warn(`Campaign Codex | NPC ${document.name} thinks it's linked to shop ${shop.name}, but shop doesn't link back`);
            brokenShopUuids.push(shopUuid);
          }
        } catch (error) {
          console.error(`Campaign Codex | Error processing shop ${shopUuid}:`, error);
        }
      }
    } catch (error) {
      console.error(`Campaign Codex | Error in shop-based location discovery:`, error);
    }
    
  } catch (error) {
    console.error(`Campaign Codex | Critical error in getAllLocations:`, error);
    await this.clearBrokenReferences(document, directLocationUuids, 'linkedLocations');
    return [];
  }
  if (brokenShopUuids.length > 0) {
  await this.clearBrokenReferences(document, brokenShopUuids, 'linkedShops');
}
  const result = Array.from(locationMap.values());
  //console.log (`Campaign Codex | Final locations for ${document.name}:`, result.map(l => `${l.name} (${l.source})`));
  return result;
}
  /**
   * Get a single linked location
   */
  static async getLinkedLocation(locationUuid) {
    if (!locationUuid) return null;
    
    try {
      const journal = await fromUuid(locationUuid);
      if (!journal) {
        console.warn(`Campaign Codex | Linked location not found: ${locationUuid}`);
        return null;
      }
      
      const imageData = journal.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";
      
      return {
        id: journal.id,
        uuid: journal.uuid,
        name: journal.name,
        img: imageData
      };
    } catch (error) {
      console.error(`Campaign Codex | Error getting linked location ${locationUuid}:`, error);
      return null;
    }
  }

  /**
   * Get linked locations with stats
   */
  static async getLinkedLocations(locationUuids) {
    if (!locationUuids || !Array.isArray(locationUuids)) return [];
    
    const locations = [];
    const brokenLocationUuids = [];
    
    for (const uuid of locationUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Linked location not found: ${uuid}`);
          brokenLocationUuids.push(uuid);
          continue;
        }
        
        const locationData = journal.getFlag("campaign-codex", "data") || {};
        const directNPCCount = (locationData.linkedNPCs || []).length;
        const imageData = journal.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";
        
        // Count shop NPCs
        let shopNPCCount = 0;
        const shopUuids = locationData.linkedShops || [];
        for (const shopUuid of shopUuids) {
          try {
            const shop = await fromUuid(shopUuid);
            if (shop) {
              const shopData = shop.getFlag("campaign-codex", "data") || {};
              shopNPCCount += (shopData.linkedNPCs || []).length;
            }
          } catch (error) {
            console.error(`Campaign Codex | Error counting shop NPCs for shop ${shopUuid}:`, error);
          }
        }
        
        const totalNPCs = directNPCCount + shopNPCCount;
        const shopCount = shopUuids.length;
        
        locations.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          meta: `<span class="entity-stat">${totalNPCs} NPCs</span> <span class="entity-stat">${shopCount} Entries</span>`
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${uuid}:`, error);
        brokenLocationUuids.push(uuid);
      }
    }
    
    return locations;
  }

  // ===========================================
  // REGION METHODS
  // ===========================================

/**
 * Get the region that contains a location using a direct two-way link.
 */
static async getLinkedRegion(locationDoc) {
  const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
  const regionUuid = locationData.parentRegion;

  if (!regionUuid) {
    return null; // No region is linked
  }

  try {
    const region = await fromUuid(regionUuid);
    if (!region) {
      // The link is broken, optionally clean it up
      console.warn(`Campaign Codex | Broken parentRegion link: ${regionUuid}`);
      // await locationDoc.unsetFlag("campaign-codex", "data.parentRegion"); // Optional cleanup
      return null;
    }
    
    return {
      id: region.id,
      uuid: region.uuid,
      name: region.name,
      img: region.getFlag("campaign-codex", "image") || "icons/svg/direction.svg"
    };
  } catch (error) {
    console.error(`Campaign Codex | Error fetching linked region ${regionUuid}:`, error);
    return null;
  }
}


  // ===========================================
  // ACTOR/NPC METHODS
  // ===========================================

  /**
   * Get a linked actor with stats
   */
  static async getLinkedActor(actorUuid) {
    if (!actorUuid) return null;

    try {
      const actor = await fromUuid(actorUuid);
      if (!actor) {
        console.warn(`Campaign Codex | Linked actor not found: ${actorUuid}`);
        return null;
      }

      return {
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        // race: actor.system.details?.race || "",
        // class: actor.system.details?.class || "", 
        // level: actor.system.details?.level || 1,
        ac: actor.system.attributes?.ac?.value || 10,
        hp: actor.system.attributes?.hp || { value: 0, max: 0 },
        // speed: actor.system.attributes?.movement?.walk || 30,
        type: actor.type
      };
    } catch (error) {
      console.error(`Campaign Codex | Error getting linked actor ${actorUuid}:`, error);
      return null;
    }
  }

  /**
   * Get associate NPCs
   */
  static async getAssociates(associateUuids) {
    if (!associateUuids || !Array.isArray(associateUuids)) return [];
    
    const associates = [];
    const brokenAssociateUuids = [];
    
    for (const uuid of associateUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Associate journal not found: ${uuid}`);
          brokenAssociateUuids.push(uuid);
          continue;
        }

        const npcData = journal.getFlag("campaign-codex", "data") || {};
        const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
        const imageData = journal.getFlag("campaign-codex", "image") || actor?.img || "icons/svg/direction.svg";
        const allLocations = await this.getAllLocations(journal, npcData.linkedLocations || []);
        const linkedShops = await this.getLinkedShopsWithLocation(npcData.linkedShops || []);
        associates.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          actor: actor,
          meta: game.campaignCodex.getActorDisplayMeta(actor),
          locations: allLocations.map(loc => loc.name), // Extract just the names
          shops: linkedShops.map(shop => shop.name)     // Extract just the names
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing associate ${uuid}:`, error);
        brokenAssociateUuids.push(uuid);
      }
    }
    
    return associates;
  }

  /**
   * Get linked NPCs
   */
  static async getLinkedNPCs(npcUuids) {
    if (!npcUuids || !Array.isArray(npcUuids)) return [];
    
    const npcs = [];
    const brokenNPCUuids = [];
    
    for (const uuid of npcUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | NPC journal not found: ${uuid}`);
          brokenNPCUuids.push(uuid);
          continue;
        }
        
        const npcData = journal.getFlag("campaign-codex", "data") || {};
        const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
        const imageData = journal.getFlag("campaign-codex", "image") || actor?.img || "icons/svg/direction.svg";

        npcs.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          actor: actor,
          meta: game.campaignCodex.getActorDisplayMeta(actor)
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing NPC ${uuid}:`, error);
        brokenNPCUuids.push(uuid);
      }
    }
    
    return npcs;
  }

  /**
   * Get all NPCs from locations (region view)
   */
  static async getAllNPCs(locationUuids) {
    if (!locationUuids || !Array.isArray(locationUuids)) return [];
    
    const npcMap = new Map();
    
    for (const locationUuid of locationUuids) {
      try {
        const location = await fromUuid(locationUuid);
        if (!location) {
          console.warn(`Campaign Codex | Location not found: ${locationUuid}`);
          continue;
        }
        
        const locationData = location.getFlag("campaign-codex", "data") || {};
        
        // Get direct location NPCs
        const directNPCUuids = locationData.linkedNPCs || [];
        for (const npcUuid of directNPCUuids) {
          try {
            const npcJournal = await fromUuid(npcUuid);
            if (!npcJournal) continue;
            
            if (!npcMap.has(npcJournal.id)) {
              const npcData = npcJournal.getFlag("campaign-codex", "data") || {};
              const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
              const imageData = npcJournal.getFlag("campaign-codex", "image") || actor?.img || "icons/svg/direction.svg";

              npcMap.set(npcJournal.id, {
                id: npcJournal.id,
                uuid: npcJournal.uuid,
                name: npcJournal.name,
                img: imageData,
                actor: actor,
                locations: [location.name],
                shops: [],
                meta: game.campaignCodex.getActorDisplayMeta(actor),
                source: 'location'
              });
            } else {
              const npc = npcMap.get(npcJournal.id);
              if (!npc.locations.includes(location.name)) {
                npc.locations.push(location.name);
              }
            }
          } catch (error) {
            console.error(`Campaign Codex | Error processing direct NPC ${npcUuid}:`, error);
          }
        }
        
        // Get shop NPCs from this location
        const shopUuids = locationData.linkedShops || [];
        for (const shopUuid of shopUuids) {
          try {
            const shop = await fromUuid(shopUuid);
            if (!shop) continue;
            
            const shopData = shop.getFlag("campaign-codex", "data") || {};
            const shopNPCUuids = shopData.linkedNPCs || [];
            
            for (const npcUuid of shopNPCUuids) {
              try {
                const npcJournal = await fromUuid(npcUuid);
                if (!npcJournal) continue;
                
                if (!npcMap.has(npcJournal.id)) {
                  const npcData = npcJournal.getFlag("campaign-codex", "data") || {};
                  const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
                  const imageData = npcJournal.getFlag("campaign-codex", "image") || actor?.img || "icons/svg/direction.svg";

                  npcMap.set(npcJournal.id, {
                    id: npcJournal.id,
                    uuid: npcJournal.uuid,
                    name: npcJournal.name,
                    img: imageData,
                    actor: actor,
                    locations: [location.name],
                    shops: [shop.name],
                    meta: game.campaignCodex.getActorDisplayMeta(actor),
                    source: 'shop'
                  });
                } else {
                  const npc = npcMap.get(npcJournal.id);
                  
                  // Add location if not already present
                  if (!npc.locations.includes(location.name)) {
                    npc.locations.push(location.name);
                  }
                  
                  // Add shop if not already present
                  if (!npc.shops.includes(shop.name)) {
                    npc.shops.push(shop.name);
                  }
                  
                  // Update source if this NPC is now found in a shop
                  if (npc.source === 'location' && shopNPCUuids.includes(npcUuid)) {
                    npc.source = 'shop';
                  }
                }
              } catch (error) {
                console.error(`Campaign Codex | Error processing shop NPC ${npcUuid}:`, error);
              }
            }
          } catch (error) {
            console.error(`Campaign Codex | Error processing shop ${shopUuid}:`, error);
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${locationUuid}:`, error);
      }
    }
    
    return Array.from(npcMap.values());
  }

  /**
   * Get directly linked NPCs
   */
  static async getDirectNPCs(npcUuids) {
    if (!npcUuids || !Array.isArray(npcUuids)) return [];
    
    const npcs = [];
    
    for (const uuid of npcUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Direct NPC journal not found: ${uuid}`);
          continue;
        }
        
        const npcData = journal.getFlag("campaign-codex", "data") || {};
        const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
        const imageData = journal.getFlag("campaign-codex", "image") || actor?.img || "icons/svg/direction.svg";

        npcs.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          actor: actor,
          meta: game.campaignCodex.getActorDisplayMeta(actor),
          source: 'direct'
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing direct NPC ${uuid}:`, error);
      }
    }
    
    return npcs;
  }

  /**
   * Get NPCs from linked shops
   */
  static async getShopNPCs(shopUuids) {
    if (!shopUuids || !Array.isArray(shopUuids)) return [];
    
    const npcMap = new Map();
    
    for (const shopUuid of shopUuids) {
      try {
        const shop = await fromUuid(shopUuid);
        if (!shop) {
          console.warn(`Campaign Codex | Shop not found: ${shopUuid}`);
          continue;
        }
        
        const shopData = shop.getFlag("campaign-codex", "data") || {};
        const linkedNPCUuids = shopData.linkedNPCs || [];
        
        for (const npcUuid of linkedNPCUuids) {
          try {
            const npcJournal = await fromUuid(npcUuid);
            if (!npcJournal) continue;
            
            if (!npcMap.has(npcJournal.id)) {
              const npcData = npcJournal.getFlag("campaign-codex", "data") || {};
              const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
              const imageData = npcJournal.getFlag("campaign-codex", "image") || actor?.img || "icons/svg/direction.svg";

              npcMap.set(npcJournal.id, {
                id: npcJournal.id,
                uuid: npcJournal.uuid,
                name: npcJournal.name,
                img: imageData,
                actor: actor,
                shops: [shop.name],
                meta: game.campaignCodex.getActorDisplayMeta(actor),
                source: 'shop'
              });
            } else {
              const npc = npcMap.get(npcJournal.id);
              if (!npc.shops.includes(shop.name)) {
                npc.shops.push(shop.name);
              }
            }
          } catch (error) {
            console.error(`Campaign Codex | Error processing shop NPC ${npcUuid}:`, error);
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${shopUuid}:`, error);
      }
    }
    
    return Array.from(npcMap.values());
  }

  // ===========================================
  // SHOP METHODS
  // ===========================================

  /**
   * Get linked shops with location info
   */
  static async getLinkedShopsWithLocation(shopUuids) {
    if (!shopUuids || !Array.isArray(shopUuids)) return [];
    
    const shops = [];
    const brokenShopUuids = [];
    
    for (const uuid of shopUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Shop journal not found: ${uuid}`);
          brokenShopUuids.push(uuid);
          continue;
        }
        
        // Find which location this shop is in
        const shopData = journal.getFlag("campaign-codex", "data") || {};
        const linkedLocationUuid = shopData.linkedLocation;
        const imageData = journal.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";

        let locationName = 'Unknown';
        
        if (linkedLocationUuid) {
          const location = await fromUuid(linkedLocationUuid);
          if (location) {
            locationName = location.name;
          }
        }
        
        shops.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          meta: `<span class="entity-type">${locationName}</span>`
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${uuid}:`, error);
        brokenShopUuids.push(uuid);
      }
    }
    
    return shops;
  }

  /**
   * Get linked shops with NPC count
   */
  static async getLinkedShops(shopUuids) {
    if (!shopUuids || !Array.isArray(shopUuids)) return [];
    
    const shops = [];
    const brokenShopUuids = [];
    
    for (const uuid of shopUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Shop journal not found: ${uuid}`);
          brokenShopUuids.push(uuid);
          continue;
        }
        
        const shopData = journal.getFlag("campaign-codex", "data") || {};
        const npcCount = (shopData.linkedNPCs || []).length;
        const imageData = journal.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";

        shops.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          meta: `<span class="entity-stat">${npcCount} NPCs</span>`
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${uuid}:`, error);
        brokenShopUuids.push(uuid);
      }
    }
    
    return shops;
  }

  /**
   * Get all shops from locations (region view)
   */
  static async getAllShops(locationUuids) {
    if (!locationUuids || !Array.isArray(locationUuids)) return [];
    
    const shopMap = new Map();
    
    for (const locationUuid of locationUuids) {
      try {
        const location = await fromUuid(locationUuid);
        if (!location) {
          console.warn(`Campaign Codex | Location not found: ${locationUuid}`);
          continue;
        }
        
        const locationData = location.getFlag("campaign-codex", "data") || {};
        const linkedShopUuids = locationData.linkedShops || [];
        
        for (const shopUuid of linkedShopUuids) {
          try {
            const shopJournal = await fromUuid(shopUuid);
            if (!shopJournal) continue;
            
            if (!shopMap.has(shopJournal.id)) {
              const shopData = shopJournal.getFlag("campaign-codex", "data") || {};
              const npcCount = (shopData.linkedNPCs || []).length;
              const inventoryCount = (shopData.inventory || []).length;
              const imageData = shopJournal.getFlag("campaign-codex", "image") || "icons/svg/direction.svg";

              shopMap.set(shopJournal.id, {
                id: shopJournal.id,
                uuid: shopJournal.uuid,
                name: shopJournal.name,
                img: imageData,
                locations: [location.name],
                meta: `<span class="entity-stat">${npcCount} NPCs</span> <span class="entity-stat">${inventoryCount} Items</span>`
              });
            } else {
              const shop = shopMap.get(shopJournal.id);
              if (!shop.locations.includes(location.name)) {
                shop.locations.push(location.name);
              }
            }
          } catch (error) {
            console.error(`Campaign Codex | Error processing shop ${shopUuid}:`, error);
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${locationUuid}:`, error);
      }
    }
    
    return Array.from(shopMap.values());
  }

  // ===========================================
  // INVENTORY METHODS
  // ===========================================

  /**
   * Get shop inventory with pricing
   */
static async getInventory(document, inventoryData) {
  if (!inventoryData || !Array.isArray(inventoryData)) return [];
  
  const inventory = [];
  const brokenItemUuids = [];
  
  for (const itemData of inventoryData) {
    try {
      const item = await fromUuid(itemData.itemUuid);
      if (!item) {
        console.warn(`Campaign Codex | Inventory item not found: ${itemData.itemUuid}`);
        brokenItemUuids.push(itemData.itemUuid);
        continue;
      }
      
      const basePrice = item.system.price ? item.system.price.value : 0;
      const currency = item.system.price ? item.system.price.denomination : "gp";
      const markup = document.getFlag("campaign-codex", "data.markup") || 1.0;
      const finalPrice = itemData.customPrice || Math.round(basePrice * markup);
      
      inventory.push({
        itemId: item.id,
        itemUuid: item.uuid,
        name: item.name,
        img: item.img,
        basePrice: basePrice,
        finalPrice: finalPrice,
        currency: currency,
        quantity: itemData.quantity || 1,
        weight: item.system.weight || 0
      });
    } catch (error) {
      console.error(`Campaign Codex | Error processing inventory item:`, error);
      brokenItemUuids.push(itemData.itemUuid);
    }
  }
  
  // Clean up broken item references if any found
  if (brokenItemUuids.length > 0) {
    try {
      const currentData = document.getFlag("campaign-codex", "data") || {};
      const cleanedInventory = (currentData.inventory || []).filter(item => 
        !brokenItemUuids.includes(item.itemUuid)
      );
      
      if (cleanedInventory.length !== (currentData.inventory || []).length) {
        currentData.inventory = cleanedInventory;
        await document.setFlag("campaign-codex", "data", currentData);
        
        const removedCount = (currentData.inventory || []).length - cleanedInventory.length;
        ui.notifications.warn(`Removed ${removedCount} broken inventory items from ${document.name}`);
      }
    } catch (error) {
      console.error(`Campaign Codex | Error cleaning broken inventory items:`, error);
    }
  }
  
  return inventory;
}

}