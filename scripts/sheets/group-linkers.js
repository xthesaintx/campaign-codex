import { TemplateComponents } from './template-components.js';

export class GroupLinkers {
  static async getGroupMembers(memberUuids) {
    const members = [];
    for (const uuid of memberUuids) {
      try {
        const doc = await fromUuid(uuid);
        if (!doc) continue;
        
        const type = doc.getFlag?.("campaign-codex", "type") || 'unknown';
        members.push({
          uuid: doc.uuid,
          id: doc.id,
          name: doc.name,
          img: doc.getFlag?.("campaign-codex", "image") || doc.img,
          type: type
        });
      } catch (error) {
        console.warn(`Campaign Codex | Could not load group member: ${uuid}`, error);
      }
    }
    return members;
  }

  static async getNestedData(groupMembers) {
    const nestedData = {
      allGroups: [],
      allRegions: [],
      allLocations: [],
      allShops: [],
      allNPCs: [],
      allItems: [],
      membersByGroup: {},
      locationsByRegion: {},
      shopsByLocation: {},
      npcsByLocation: {},
      npcsByShop: {},
      itemsByShop: {},
      totalValue: 0
    };

    // This Set is the key to preventing infinite loops and redundant processing.
    const processedUuids = new Set();

    for (const member of groupMembers) {
      switch (member.type) {
        case 'group':
          await this._processGroup(member, nestedData, processedUuids);
          break;
        case 'region':
          await this._processRegion(member, nestedData, processedUuids);
          break;
        case 'location':
          await this._processLocation(member, nestedData, processedUuids);
          break;
        case 'shop':
          await this._processShop(member, nestedData, processedUuids);
          break;
        case 'npc':
          await this._processNPC(member, nestedData, processedUuids);
          break;
      }
    }

    nestedData.allNPCs = this._removeDuplicates(nestedData.allNPCs);
    return nestedData;
  }

  // --- PROCESSING METHODS ---

  static async _processGroup(group, nestedData, processedUuids) {
    if (processedUuids.has(group.uuid)) return;
    processedUuids.add(group.uuid);

    if (!nestedData.allGroups.find(g => g.uuid === group.uuid)) {
      nestedData.allGroups.push(group);
    }

    try {
      const groupDoc = await fromUuid(group.uuid);
      const groupData = groupDoc.getFlag("campaign-codex", "data") || {};
      const memberUuids = groupData.members || [];
      
      nestedData.membersByGroup[group.uuid] = [];

      for (const memberUuid of memberUuids) {
        if (memberUuid === group.uuid) continue; // Prevent self-nesting
        const memberDoc = await fromUuid(memberUuid);
        if (!memberDoc) continue;
        
        const memberType = memberDoc.getFlag("campaign-codex", "type");
        if (!memberType) continue;

        nestedData.membersByGroup[group.uuid].push({
          uuid: memberDoc.uuid,
          name: memberDoc.name,
          img: memberDoc.getFlag("campaign-codex", "image") || memberDoc.img,
          type: memberType
        });
        // We no longer recursively call from here, the main loop handles it.
      }
    } catch (error) {
      console.error(`Campaign Codex | Error processing group ${group.name}:`, error);
    }
  }

  static async _processRegion(region, nestedData, processedUuids) {
    if (processedUuids.has(region.uuid)) return;
    processedUuids.add(region.uuid);

    if (!nestedData.allRegions.find(r => r.uuid === region.uuid)) {
      nestedData.allRegions.push(region);
    }
    
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
          img: locationDoc.getFlag("campaign-codex", "image") || locationDoc.img,
          type: 'location',
          region: region.name
        };
        
        nestedData.locationsByRegion[region.uuid].push(locationInfo);
        await this._processLocation(locationInfo, nestedData, processedUuids, region.name);
      }
    } catch (error) {
      console.error(`Campaign Codex | Error processing region ${region.name}:`, error);
    }
  }

  static async _processLocation(location, nestedData, processedUuids, regionName = null) {
    if (processedUuids.has(location.uuid)) return;
    processedUuids.add(location.uuid);

    let locationInAll = nestedData.allLocations.find(l => l.uuid === location.uuid);
    if (!locationInAll) {
      locationInAll = { ...location, region: regionName, npcCount: 0, shopCount: 0 };
      nestedData.allLocations.push(locationInAll);
    }
    
    try {
      const locationDoc = await fromUuid(location.uuid);
      const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
      
      nestedData.shopsByLocation[location.uuid] = [];
      for (const shopUuid of locationData.linkedShops || []) {
        const shopDoc = await fromUuid(shopUuid);
        if (!shopDoc) continue;
        const shopInfo = { uuid: shopDoc.uuid, name: shopDoc.name, img: shopDoc.getFlag("campaign-codex", "image") || shopDoc.img, type: 'shop', location: location.name };
        nestedData.shopsByLocation[location.uuid].push(shopInfo);
        await this._processShop(shopInfo, nestedData, processedUuids, location.name);
      }
      
      nestedData.npcsByLocation[location.uuid] = [];
      for (const npcUuid of locationData.linkedNPCs || []) {
        const npcDoc = await fromUuid(npcUuid);
        if (!npcDoc) continue;
        await this._processNPC(npcDoc, nestedData, processedUuids, location.name, 'location');
      }
      
      locationInAll.shopCount = nestedData.shopsByLocation[location.uuid].length;
      locationInAll.npcCount = (nestedData.npcsByLocation[location.uuid] || []).length + 
                             Object.values(nestedData.npcsByShop).flat().filter(npc => npc.sourceLocation === location.name).length;

    } catch (error) {
      console.error(`Campaign Codex | Error processing location ${location.name}:`, error);
    }
  }

  static async _processShop(shop, nestedData, processedUuids, locationName = null) {
    if (processedUuids.has(shop.uuid)) return;
    processedUuids.add(shop.uuid);

    if (!nestedData.allShops.find(s => s.uuid === shop.uuid)) {
      nestedData.allShops.push({ ...shop, location: locationName });
    }
    
    try {
      const shopDoc = await fromUuid(shop.uuid);
      const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
      
      nestedData.npcsByShop[shop.uuid] = [];
      for (const npcUuid of shopData.linkedNPCs || []) {
        const npcDoc = await fromUuid(npcUuid);
        if (!npcDoc) continue;
        await this._processNPC(npcDoc, nestedData, processedUuids, shop.name, 'shop');
      }
      
      nestedData.itemsByShop[shop.uuid] = [];
      for (const itemData of shopData.inventory || []) {
        const item = await fromUuid(itemData.itemUuid).catch(() => null);
        if (!item) continue;
        const finalPrice = itemData.customPrice ?? (item.system.price?.value || 0) * (shopData.markup || 1.0);
        const itemInfo = { uuid: item.uuid, name: item.name, img: item.img, type: 'item', shop: shop.name, quantity: itemData.quantity || 1, finalPrice: finalPrice, currency: item.system.price?.denomination || "gp" };
        nestedData.itemsByShop[shop.uuid].push(itemInfo);
        if (!nestedData.allItems.find(i => i.uuid === item.uuid)) {
          nestedData.allItems.push(itemInfo);
        }
        nestedData.totalValue += finalPrice * itemInfo.quantity;
      }
    } catch (error) {
      console.error(`Campaign Codex | Error processing shop ${shop.name}:`, error);
    }
  }

  static async _processNPC(npc, nestedData, processedUuids, sourceName, sourceType) {
    if (processedUuids.has(npc.uuid)) return;
    processedUuids.add(npc.uuid);

    const npcInfo = await this._createNPCInfo(npc, sourceName, sourceType);
    nestedData.allNPCs.push(npcInfo);

    if (sourceType === 'location') {
      const location = nestedData.allLocations.find(l => l.name === sourceName);
      if (location && nestedData.npcsByLocation[location.uuid]) {
        nestedData.npcsByLocation[location.uuid].push(npcInfo);
      }
    } else if (sourceType === 'shop') {
      const shop = nestedData.allShops.find(s => s.name === sourceName);
      if (shop && nestedData.npcsByShop[shop.uuid]) {
        nestedData.npcsByShop[shop.uuid].push(npcInfo);
      }
    }
  }

  // --- HELPER METHODS ---

  static async _createNPCInfo(npcDoc, sourceName, sourceType) {
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor).catch(() => null) : null;
    return {
      uuid: npcDoc.uuid,
      name: npcDoc.name,
      img: npcDoc.getFlag("campaign-codex", "image") || actor?.img,
      type: 'npc',
      source: sourceType,
      sourceLocation: sourceType === 'location' ? sourceName : null,
      sourceShop: sourceType === 'shop' ? sourceName : null,
      actor: actor ? { uuid: actor.uuid, name: actor.name, img: actor.img, ac: actor.system.attributes?.ac?.value || 10, hp: actor.system.attributes?.hp || { value: 0, max: 0 } } : null
    };
  }

  static _removeDuplicates(array) {
    return array.filter((item, index, self) => index === self.findIndex(t => t.uuid === item.uuid));
  }
}