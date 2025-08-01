import { TemplateComponents } from './template-components.js';

// scripts/sheets/group-linkers.js
export class GroupLinkers {
  /**
   * Get all group members with their basic info
   */
  static async getGroupMembers(memberUuids) {
    const members = [];
    
    for (const uuid of memberUuids) {
      try {
        const doc = await fromUuid(uuid);
        if (!doc) continue;
        
        const type = doc.getFlag?.("campaign-codex", "type") || 'unknown';
        const customImage = doc.getFlag?.("campaign-codex", "image");
        
        members.push({
          uuid: doc.uuid,
          id: doc.id,
          name: doc.name,
          img: customImage || doc.img || TemplateComponents.getAsset('image', 'group'),
          type: type
        });
      } catch (error) {
        console.warn(`Campaign Codex | Could not load group member: ${uuid}`, error);
      }
    }
    
    return members;
  }

  /**
   * Get all nested data for the group members
   */
  static async getNestedData(groupMembers) {
    const nestedData = {
      allRegions: [],
      allLocations: [],
      allShops: [],
      allNPCs: [],
      allItems: [],
      locationsByRegion: {},
      shopsByLocation: {},
      npcsByLocation: {},
      npcsByShop: {},
      itemsByShop: {},
      totalValue: 0
    };

    // Process each member type
    for (const member of groupMembers) {
      switch (member.type) {
        case 'region':
          await this._processRegion(member, nestedData);
          break;
        case 'location':
          await this._processLocation(member, nestedData);
          break;
        case 'shop':
          await this._processShop(member, nestedData);
          break;
        case 'npc':
          await this._processNPC(member, nestedData);
          break;
      }
    }

    // Remove duplicates
    nestedData.allRegions = this._removeDuplicates(nestedData.allRegions);
    nestedData.allLocations = this._removeDuplicates(nestedData.allLocations);
    nestedData.allShops = this._removeDuplicates(nestedData.allShops);
    nestedData.allNPCs = this._removeDuplicates(nestedData.allNPCs);
    nestedData.allItems = this._removeDuplicates(nestedData.allItems);

    return nestedData;
  }

  // static async _processRegion(region, nestedData) {
  //   nestedData.allRegions.push(region);
    
  //   try {
  //     const regionDoc = await fromUuid(region.uuid);
  //     const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
  //     const linkedLocationUuids = regionData.linkedLocations || [];
      
  //     nestedData.locationsByRegion[region.uuid] = [];
      
  //     for (const locationUuid of linkedLocationUuids) {
  //       const locationDoc = await fromUuid(locationUuid);
  //       if (!locationDoc) continue;
        
  //       const locationInfo = {
  //         uuid: locationDoc.uuid,
  //         name: locationDoc.name,
  //         img: locationDoc.getFlag("campaign-codex", "image") || locationDoc.img || TemplateComponents.getAsset('image', 'location'),
  //         type: 'location',
  //         region: region.name
  //       };
        
  //       nestedData.locationsByRegion[region.uuid].push(locationInfo);
  //       nestedData.allLocations.push(locationInfo);
        
  //       // Process the location's children
  //       await this._processLocation(locationInfo, nestedData, region.name);
  //     }
  //   } catch (error) {
  //     console.error(`Campaign Codex | Error processing region ${region.name}:`, error);
  //   }
  // }

  // static async _processLocation(location, nestedData, regionName = null) {
  //   if (!nestedData.allLocations.find(l => l.uuid === location.uuid)) {
  //     nestedData.allLocations.push({
  //       ...location,
  //       region: regionName,
  //       npcCount: 0,
  //       shopCount: 0
  //     });
  //   }
    
  //   try {
  //     const locationDoc = await fromUuid(location.uuid);
  //     const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
      
  //     // Process linked shops
  //     const linkedShopUuids = locationData.linkedShops || [];
  //     nestedData.shopsByLocation[location.uuid] = [];
      
  //     for (const shopUuid of linkedShopUuids) {
  //       const shopDoc = await fromUuid(shopUuid);
  //       if (!shopDoc) continue;
        
  //       const shopInfo = {
  //         uuid: shopDoc.uuid,
  //         name: shopDoc.name,
  //         img: shopDoc.getFlag("campaign-codex", "image") || shopDoc.img || TemplateComponents.getAsset('image', 'shop'),
  //         type: 'shop',
  //         location: location.name
  //       };
        
  //       nestedData.shopsByLocation[location.uuid].push(shopInfo);
  //       nestedData.allShops.push(shopInfo);
        
  //       // Process the shop's children
  //       await this._processShop(shopInfo, nestedData, location.name);
  //     }
      
  //     // Process linked NPCs
  //     const linkedNPCUuids = locationData.linkedNPCs || [];
  //     nestedData.npcsByLocation[location.uuid] = [];
      
  //     for (const npcUuid of linkedNPCUuids) {
  //       const npcDoc = await fromUuid(npcUuid);
  //       if (!npcDoc) continue;
        
  //       const npcInfo = await this._createNPCInfo(npcDoc, location.name, 'location');
  //       nestedData.npcsByLocation[location.uuid].push(npcInfo);
  //       nestedData.allNPCs.push(npcInfo);
  //     }
      
  //     // Update location stats
  //     const locationInAll = nestedData.allLocations.find(l => l.uuid === location.uuid);
  //     if (locationInAll) {
  //       locationInAll.npcCount = (nestedData.npcsByLocation[location.uuid] || []).length;
  //       locationInAll.shopCount = (nestedData.shopsByLocation[location.uuid] || []).length;
  //     }
      
  //   } catch (error) {
  //     console.error(`Campaign Codex | Error processing location ${location.name}:`, error);
  //   }
  // }

  // static async _processShop(shop, nestedData, locationName = null) {
  //   if (!nestedData.allShops.find(s => s.uuid === shop.uuid)) {
  //     nestedData.allShops.push({
  //       ...shop,
  //       location: locationName
  //     });
  //   }
    
  //   try {
  //     const shopDoc = await fromUuid(shop.uuid);
  //     const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
      
  //     // Process linked NPCs
  //     const linkedNPCUuids = shopData.linkedNPCs || [];
  //     nestedData.npcsByShop[shop.uuid] = [];
      
  //     for (const npcUuid of linkedNPCUuids) {
  //       const npcDoc = await fromUuid(npcUuid);
  //       if (!npcDoc) continue;
        
  //       const npcInfo = await this._createNPCInfo(npcDoc, shop.name, 'shop');
  //       nestedData.npcsByShop[shop.uuid].push(npcInfo);
  //       nestedData.allNPCs.push(npcInfo);
  //     }
      
  //     // Process inventory items
  //     const inventory = shopData.inventory || [];
  //     nestedData.itemsByShop[shop.uuid] = [];
      
  //     for (const itemData of inventory) {
  //       try {
  //         const item = await fromUuid(itemData.itemUuid);
  //         if (!item) continue;
          
  //         const basePrice = item.system.price?.value || 0;
  //         const currency = item.system.price?.denomination || "gp";
  //         const markup = shopData.markup || 1.0;
  //         const finalPrice = itemData.customPrice ?? (basePrice * markup);
          
  //         const itemInfo = {
  //           uuid: item.uuid,
  //           name: item.name,
  //           img: item.img || TemplateComponents.getAsset('image', 'item'),
  //           type: 'item',
  //           shop: shop.name,
  //           quantity: itemData.quantity || 1,
  //           basePrice: basePrice,
  //           finalPrice: finalPrice,
  //           currency: currency
  //         };
          
  //         nestedData.itemsByShop[shop.uuid].push(itemInfo);
  //         nestedData.allItems.push(itemInfo);
  //         nestedData.totalValue += finalPrice * itemInfo.quantity;
          
  //       } catch (error) {
  //         console.warn(`Campaign Codex | Could not load item ${itemData.itemUuid}:`, error);
  //       }
  //     }
      
  //   } catch (error) {
  //     console.error(`Campaign Codex | Error processing shop ${shop.name}:`, error);
  //   }
  // }


static async _processRegion(region, nestedData) {
  nestedData.allRegions.push(region);
  
  try {
    const regionDoc = await fromUuid(region.uuid);
    const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
    const linkedLocationUuids = regionData.linkedLocations || [];
    
    nestedData.locationsByRegion[region.uuid] = [];
    
    for (const locationUuid of linkedLocationUuids) {
      const locationDoc = await fromUuid(locationUuid);
      if (!locationDoc) continue;
      
      const locationInfo = {
        uuid: locationDoc.uuid,
        name: locationDoc.name,
        img: locationDoc.getFlag("campaign-codex", "image") || locationDoc.img || TemplateComponents.getAsset('image', 'location'),
        type: 'location',
        region: region.name,
        npcCount: 0,
        shopCount: 0
      };
      
      nestedData.locationsByRegion[region.uuid].push(locationInfo);
      
      // Only add to allLocations if not already there
      if (!nestedData.allLocations.find(l => l.uuid === locationInfo.uuid)) {
        nestedData.allLocations.push(locationInfo);
      }
      
      // IMPORTANT: Recursively process the location's children 
      // This ensures shops and NPCs in locations within regions are captured
      await this._processLocation(locationInfo, nestedData, region.name);
    }
  } catch (error) {
    console.error(`Campaign Codex | Error processing region ${region.name}:`, error);
  }
}

// Updated _processLocation method with better duplicate handling
static async _processLocation(location, nestedData, regionName = null) {
  // Find or add to allLocations
  let locationInAll = nestedData.allLocations.find(l => l.uuid === location.uuid);
  if (!locationInAll) {
    locationInAll = {
      ...location,
      region: regionName,
      npcCount: 0,
      shopCount: 0
    };
    nestedData.allLocations.push(locationInAll);
  } else {
    // Update region if not set
    if (!locationInAll.region && regionName) {
      locationInAll.region = regionName;
    }
  }
  
  try {
    const locationDoc = await fromUuid(location.uuid);
    const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    
    // Initialize collections if they don't exist
    if (!nestedData.shopsByLocation[location.uuid]) {
      nestedData.shopsByLocation[location.uuid] = [];
    }
    if (!nestedData.npcsByLocation[location.uuid]) {
      nestedData.npcsByLocation[location.uuid] = [];
    }
    
    // Process linked shops
    const linkedShopUuids = locationData.linkedShops || [];
    
    for (const shopUuid of linkedShopUuids) {
      const shopDoc = await fromUuid(shopUuid);
      if (!shopDoc) continue;
      
      const shopInfo = {
        uuid: shopDoc.uuid,
        name: shopDoc.name,
        img: shopDoc.getFlag("campaign-codex", "image") || shopDoc.img || TemplateComponents.getAsset('image', 'shop'),
        type: 'shop',
        location: location.name
      };
      
      // Avoid duplicates in location's shop list
      if (!nestedData.shopsByLocation[location.uuid].find(s => s.uuid === shopInfo.uuid)) {
        nestedData.shopsByLocation[location.uuid].push(shopInfo);
      }
      
      // Add to allShops if not already there
      if (!nestedData.allShops.find(s => s.uuid === shopInfo.uuid)) {
        nestedData.allShops.push(shopInfo);
      }
      
      // IMPORTANT: Recursively process the shop's children
      // This ensures NPCs and items in shops within locations are captured
      await this._processShop(shopInfo, nestedData, location.name);
    }
    
    // Process linked NPCs
    const linkedNPCUuids = locationData.linkedNPCs || [];
    
    for (const npcUuid of linkedNPCUuids) {
      const npcDoc = await fromUuid(npcUuid);
      if (!npcDoc) continue;
      
      const npcInfo = await this._createNPCInfo(npcDoc, location.name, 'location');
      
      // Avoid duplicates in location's NPC list
      if (!nestedData.npcsByLocation[location.uuid].find(n => n.uuid === npcInfo.uuid)) {
        nestedData.npcsByLocation[location.uuid].push(npcInfo);
      }
      
      // Add to allNPCs if not already there
      if (!nestedData.allNPCs.find(n => n.uuid === npcInfo.uuid)) {
        nestedData.allNPCs.push(npcInfo);
      }
    }
    
    // Update location stats
    locationInAll.npcCount = nestedData.npcsByLocation[location.uuid].length;
    locationInAll.shopCount = nestedData.shopsByLocation[location.uuid].length;
    
  } catch (error) {
    console.error(`Campaign Codex | Error processing location ${location.name}:`, error);
  }
}

// Updated _processShop method with better duplicate handling
static async _processShop(shop, nestedData, locationName = null) {
  // Find or add to allShops
  let shopInAll = nestedData.allShops.find(s => s.uuid === shop.uuid);
  if (!shopInAll) {
    shopInAll = {
      ...shop,
      location: locationName
    };
    nestedData.allShops.push(shopInAll);
  } else {
    // Update location if not set
    if (!shopInAll.location && locationName) {
      shopInAll.location = locationName;
    }
  }
  
  try {
    const shopDoc = await fromUuid(shop.uuid);
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    
    // Initialize collections if they don't exist
    if (!nestedData.npcsByShop[shop.uuid]) {
      nestedData.npcsByShop[shop.uuid] = [];
    }
    if (!nestedData.itemsByShop[shop.uuid]) {
      nestedData.itemsByShop[shop.uuid] = [];
    }
    
    // Process linked NPCs
    const linkedNPCUuids = shopData.linkedNPCs || [];
    
    for (const npcUuid of linkedNPCUuids) {
      const npcDoc = await fromUuid(npcUuid);
      if (!npcDoc) continue;
      
      const npcInfo = await this._createNPCInfo(npcDoc, shop.name, 'shop');
      
      // Avoid duplicates in shop's NPC list
      if (!nestedData.npcsByShop[shop.uuid].find(n => n.uuid === npcInfo.uuid)) {
        nestedData.npcsByShop[shop.uuid].push(npcInfo);
      }
      
      // Add to allNPCs if not already there
      if (!nestedData.allNPCs.find(n => n.uuid === npcInfo.uuid)) {
        nestedData.allNPCs.push(npcInfo);
      }
    }
    
    // Process inventory items
    const inventory = shopData.inventory || [];
    
    for (const itemData of inventory) {
      try {
        const item = await fromUuid(itemData.itemUuid);
        if (!item) continue;
        
        const basePrice = item.system.price?.value || 0;
        const currency = item.system.price?.denomination || "gp";
        const markup = shopData.markup || 1.0;
        const finalPrice = itemData.customPrice ?? (basePrice * markup);
        
        const itemInfo = {
          uuid: item.uuid,
          name: item.name,
          img: item.img || TemplateComponents.getAsset('image', 'item'),
          type: 'item',
          shop: shop.name,
          quantity: itemData.quantity || 1,
          basePrice: basePrice,
          finalPrice: finalPrice,
          currency: currency
        };
        
        // Add to shop's items (allow duplicates here as they represent inventory entries)
        nestedData.itemsByShop[shop.uuid].push(itemInfo);
        
        // Add to allItems if not already there (or if it's a different inventory entry)
        nestedData.allItems.push(itemInfo);
        nestedData.totalValue += finalPrice * itemInfo.quantity;
        
      } catch (error) {
        console.warn(`Campaign Codex | Could not load item ${itemData.itemUuid}:`, error);
      }
    }
    
  } catch (error) {
    console.error(`Campaign Codex | Error processing shop ${shop.name}:`, error);
  }
}

  

  static async _processNPC(npc, nestedData) {
    try {
      const npcDoc = await fromUuid(npc.uuid);
      const npcInfo = await this._createNPCInfo(npcDoc, null, 'direct');
      nestedData.allNPCs.push(npcInfo);
    } catch (error) {
      console.error(`Campaign Codex | Error processing NPC ${npc.name}:`, error);
    }
  }

  static async _createNPCInfo(npcDoc, sourceName, sourceType) {
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    let actor = null;
    
    if (npcData.linkedActor) {
      try {
        actor = await fromUuid(npcData.linkedActor);
      } catch (error) {
        console.warn(`Campaign Codex | Could not load actor for NPC ${npcDoc.name}`);
      }
    }
    
    const customImage = npcDoc.getFlag("campaign-codex", "image");
    
    return {
      uuid: npcDoc.uuid,
      name: npcDoc.name,
      img: customImage || actor?.img || TemplateComponents.getAsset('image', 'npc'),
      type: 'npc',
      source: sourceType,
      sourceLocation: sourceType === 'location' ? sourceName : null,
      sourceShop: sourceType === 'shop' ? sourceName : null,
      actor: actor ? {
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        ac: actor.system.attributes?.ac?.value || 10,
        hp: actor.system.attributes?.hp || { value: 0, max: 0 },
        type: actor.type
      } : null
    };
  }

  static _removeDuplicates(array) {
    const seen = new Set();
    return array.filter(item => {
      if (seen.has(item.uuid)) {
        return false;
      }
      seen.add(item.uuid);
      return true;
    });
  }
}