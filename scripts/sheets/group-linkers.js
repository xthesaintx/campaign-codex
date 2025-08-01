import { TemplateComponents } from './template-components.js';

export class GroupLinkers {
  static async getGroupMembers(memberUuids) {
    if (!memberUuids) return [];
    const members = [];
    for (const uuid of memberUuids) {
      const doc = await fromUuid(uuid).catch(() => null);
      if (!doc) continue;
      const type = doc.getFlag?.("campaign-codex", "type") || 'unknown';
      members.push({ uuid: doc.uuid, name: doc.name, img: doc.getFlag?.("campaign-codex", "image") || doc.img, type });
    }
    return members;
  }

  static async getNestedData(groupMembers) {
    const nestedData = {
      allGroups: [], allRegions: [], allLocations: [], allShops: [], allNPCs: [], allItems: [],
      membersByGroup: {}, locationsByRegion: {}, shopsByLocation: {}, npcsByLocation: {}, npcsByShop: {}, itemsByShop: {},
      totalValue: 0
    };
    const processedUuids = new Set();
    for (const member of groupMembers) {
      await this._processEntity(member, nestedData, processedUuids);
    }
    nestedData.allNPCs = this._removeDuplicates(nestedData.allNPCs);
    return nestedData;
  }

  static async _processEntity(entity, nestedData, processedUuids, parent = null) {
    if (!entity || !entity.type || processedUuids.has(entity.uuid)) return;
    processedUuids.add(entity.uuid);

    switch (entity.type) {
      case 'group':    await this._processGroup(entity, nestedData, processedUuids); break;
      case 'region':   await this._processRegion(entity, nestedData, processedUuids); break;
      case 'location': await this._processLocation(entity, nestedData, processedUuids, parent); break;
      case 'shop':     await this._processShop(entity, nestedData, processedUuids, parent); break;
      case 'npc':      await this._processNPC(entity, nestedData, parent); break;
    }
  }

  static async _processGroup(group, nestedData, processedUuids) {
    if (!nestedData.allGroups.find(g => g.uuid === group.uuid)) nestedData.allGroups.push(group);
    const groupDoc = await fromUuid(group.uuid);
    const groupData = groupDoc.getFlag("campaign-codex", "data") || {};
    const members = await this.getGroupMembers(groupData.members);
    nestedData.membersByGroup[group.uuid] = members;
    for (const member of members) {
      await this._processEntity(member, nestedData, processedUuids, group);
    }
  }

  static async _processRegion(region, nestedData, processedUuids) {
    if (!nestedData.allRegions.find(r => r.uuid === region.uuid)) nestedData.allRegions.push(region);
    const regionDoc = await fromUuid(region.uuid);
    const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
    nestedData.locationsByRegion[region.uuid] = [];

    for (const locationUuid of regionData.linkedLocations || []) {
      const locationDoc = await fromUuid(locationUuid).catch(() => null);
      if (!locationDoc) continue;
      const locationInfo = { uuid: locationDoc.uuid, name: locationDoc.name, img: locationDoc.getFlag("campaign-codex", "image") || locationDoc.img, type: 'location' };
      nestedData.locationsByRegion[region.uuid].push(locationInfo);
      await this._processEntity(locationInfo, nestedData, processedUuids, region);
    }
  }

  static async _processLocation(location, nestedData, processedUuids, parent) {
    if (!nestedData.allLocations.find(l => l.uuid === location.uuid)) nestedData.allLocations.push(location);
    const locationDoc = await fromUuid(location.uuid);
    const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    
    nestedData.shopsByLocation[location.uuid] = [];
    for (const shopUuid of locationData.linkedShops || []) {
      const shopDoc = await fromUuid(shopUuid).catch(() => null);
      if (!shopDoc) continue;
      const shopInfo = { uuid: shopDoc.uuid, name: shopDoc.name, img: shopDoc.getFlag("campaign-codex", "image") || shopDoc.img, type: 'shop' };
      nestedData.shopsByLocation[location.uuid].push(shopInfo);
      await this._processEntity(shopInfo, nestedData, processedUuids, location);
    }

    nestedData.npcsByLocation[location.uuid] = [];
    for (const npcUuid of locationData.linkedNPCs || []) {
      const npcInfo = { uuid: npcUuid, type: 'npc' };
      await this._processEntity(npcInfo, nestedData, processedUuids, location);
    }
  }

  static async _processShop(shop, nestedData, processedUuids, parent) {
    if (!nestedData.allShops.find(s => s.uuid === shop.uuid)) nestedData.allShops.push(shop);
    const shopDoc = await fromUuid(shop.uuid);
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};

    nestedData.npcsByShop[shop.uuid] = [];
    for (const npcUuid of shopData.linkedNPCs || []) {
      const npcInfo = { uuid: npcUuid, type: 'npc' };
      await this._processEntity(npcInfo, nestedData, processedUuids, shop);
    }

    nestedData.itemsByShop[shop.uuid] = [];
    for (const itemData of shopData.inventory || []) {
      const item = await fromUuid(itemData.itemUuid).catch(() => null);
      if (!item) continue;
      const finalPrice = itemData.customPrice ?? (item.system.price?.value || 0) * (shopData.markup || 1.0);
      const itemInfo = { uuid: item.uuid, name: item.name, img: item.img, type: 'item', quantity: itemData.quantity || 1, finalPrice };
      nestedData.itemsByShop[shop.uuid].push(itemInfo);
      nestedData.allItems.push(itemInfo);
      nestedData.totalValue += finalPrice * itemInfo.quantity;
    }
  }
  
  static async _processNPC(npc, nestedData, parent) {
    const npcDoc = await fromUuid(npc.uuid).catch(() => null);
    if (!npcDoc) return;
    
    // Pass the parent's name and type to correctly set the source
    const npcInfo = await this._createNPCInfo(npcDoc, parent?.name, parent?.type);
    
    if (!nestedData.allNPCs.find(n => n.uuid === npcInfo.uuid)) {
      nestedData.allNPCs.push(npcInfo);
    }

    if (parent?.type === 'location') {
      if (!nestedData.npcsByLocation[parent.uuid]) nestedData.npcsByLocation[parent.uuid] = [];
      nestedData.npcsByLocation[parent.uuid].push(npcInfo);
    } else if (parent?.type === 'shop') {
      if (!nestedData.npcsByShop[parent.uuid]) nestedData.npcsByShop[parent.uuid] = [];
      nestedData.npcsByShop[parent.uuid].push(npcInfo);
    }
  }
  static async _createNPCInfo(npcDoc, sourceName, sourceType) {
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor).catch(() => null) : null;
    
    // If there's no parent source, it's 'direct'
    const finalSourceType = sourceType || 'direct';

    return {
      uuid: npcDoc.uuid,
      name: npcDoc.name,
      img: npcDoc.getFlag("campaign-codex", "image") || actor?.img,
      type: 'npc',
      // Add these properties back
      source: finalSourceType,
      sourceLocation: finalSourceType === 'location' ? sourceName : null,
      sourceShop: finalSourceType === 'shop' ? sourceName : null,
      actor: actor ? { uuid: actor.uuid, name: actor.name, ac: actor.system.attributes?.ac?.value || 10, hp: actor.system.attributes?.hp || { value: 0, max: 0 } } : null
    };
  }
    static _removeDuplicates(array) {
    return array.filter((item, index, self) => index === self.findIndex(t => t.uuid === item.uuid));
  }
}

// import { TemplateComponents } from './template-components.js';

// export class GroupLinkers {
//   static async getGroupMembers(memberUuids) {
//     if (!memberUuids) return [];
//     const members = [];
//     for (const uuid of memberUuids) {
//       const doc = await fromUuid(uuid).catch(() => null);
//       if (!doc) continue;
//       const type = doc.getFlag?.("campaign-codex", "type") || 'unknown';
//       members.push({ uuid: doc.uuid, name: doc.name, img: doc.getFlag?.("campaign-codex", "image") || doc.img, type });
//     }
//     return members;
//   }

//   static async getNestedData(groupMembers) {
//     const nestedData = {
//       allGroups: [], allRegions: [], allLocations: [], allShops: [], allNPCs: [], allItems: [],
//       membersByGroup: {}, locationsByRegion: {}, shopsByLocation: {}, npcsByLocation: {}, npcsByShop: {}, itemsByShop: {},
//       totalValue: 0
//     };
//     const processedUuids = new Set();
//     for (const member of groupMembers) {
//       await this._processEntity(member, nestedData, processedUuids);
//     }
//     nestedData.allNPCs = this._removeDuplicates(nestedData.allNPCs);
//     return nestedData;
//   }

//   static async _processEntity(entity, nestedData, processedUuids) {
//     if (!entity || !entity.type || processedUuids.has(entity.uuid)) return;
//     processedUuids.add(entity.uuid);

//     switch (entity.type) {
//       case 'group':    await this._processGroup(entity, nestedData, processedUuids); break;
//       case 'region':   await this._processRegion(entity, nestedData, processedUuids); break;
//       case 'location': await this._processLocation(entity, nestedData, processedUuids); break;
//       case 'shop':     await this._processShop(entity, nestedData, processedUuids); break;
//       case 'npc':      await this._processNPC(entity, nestedData); break;
//     }
//   }

//   static async _processGroup(group, nestedData, processedUuids) {
//     if (!nestedData.allGroups.find(g => g.uuid === group.uuid)) nestedData.allGroups.push(group);
//     const groupDoc = await fromUuid(group.uuid);
//     const groupData = groupDoc.getFlag("campaign-codex", "data") || {};
//     nestedData.membersByGroup[group.uuid] = await this.getGroupMembers(groupData.members);
//   }

//   static async _processRegion(region, nestedData, processedUuids) {
//     if (!nestedData.allRegions.find(r => r.uuid === region.uuid)) nestedData.allRegions.push(region);
//     const regionDoc = await fromUuid(region.uuid);
//     const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
//     nestedData.locationsByRegion[region.uuid] = [];

//     for (const locationUuid of regionData.linkedLocations || []) {
//       const locationDoc = await fromUuid(locationUuid).catch(() => null);
//       if (!locationDoc) continue;
//       const locationInfo = { uuid: locationDoc.uuid, name: locationDoc.name, img: locationDoc.getFlag("campaign-codex", "image") || locationDoc.img, type: 'location' };
//       nestedData.locationsByRegion[region.uuid].push(locationInfo);
//       await this._processEntity(locationInfo, nestedData, processedUuids);
//     }
//   }

//   static async _processLocation(location, nestedData, processedUuids) {
//     if (!nestedData.allLocations.find(l => l.uuid === location.uuid)) nestedData.allLocations.push(location);
//     const locationDoc = await fromUuid(location.uuid);
//     const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    
//     nestedData.shopsByLocation[location.uuid] = [];
//     for (const shopUuid of locationData.linkedShops || []) {
//       const shopDoc = await fromUuid(shopUuid).catch(() => null);
//       if (!shopDoc) continue;
//       const shopInfo = { uuid: shopDoc.uuid, name: shopDoc.name, img: shopDoc.getFlag("campaign-codex", "image") || shopDoc.img, type: 'shop' };
//       nestedData.shopsByLocation[location.uuid].push(shopInfo);
//       await this._processEntity(shopInfo, nestedData, processedUuids);
//     }

//     nestedData.npcsByLocation[location.uuid] = [];
//     for (const npcUuid of locationData.linkedNPCs || []) {
//       const npcDoc = await fromUuid(npcUuid).catch(() => null);
//       if (!npcDoc) continue;
//       const npcInfo = await this._createNPCInfo(npcDoc);
//       nestedData.npcsByLocation[location.uuid].push(npcInfo);
//       await this._processEntity(npcInfo, nestedData, processedUuids);
//     }
//   }

//   static async _processShop(shop, nestedData, processedUuids) {
//     if (!nestedData.allShops.find(s => s.uuid === shop.uuid)) nestedData.allShops.push(shop);
//     const shopDoc = await fromUuid(shop.uuid);
//     const shopData = shopDoc.getFlag("campaign-codex", "data") || {};

//     nestedData.npcsByShop[shop.uuid] = [];
//     for (const npcUuid of shopData.linkedNPCs || []) {
//       const npcDoc = await fromUuid(npcUuid).catch(() => null);
//       if (!npcDoc) continue;
//       const npcInfo = await this._createNPCInfo(npcDoc);
//       nestedData.npcsByShop[shop.uuid].push(npcInfo);
//       await this._processEntity(npcInfo, nestedData, processedUuids);
//     }

//     nestedData.itemsByShop[shop.uuid] = [];
//     for (const itemData of shopData.inventory || []) {
//       const item = await fromUuid(itemData.itemUuid).catch(() => null);
//       if (!item) continue;
//       const finalPrice = itemData.customPrice ?? (item.system.price?.value || 0) * (shopData.markup || 1.0);
//       const itemInfo = { uuid: item.uuid, name: item.name, img: item.img, type: 'item', quantity: itemData.quantity || 1, finalPrice };
//       nestedData.itemsByShop[shop.uuid].push(itemInfo);
//       nestedData.allItems.push(itemInfo);
//       nestedData.totalValue += finalPrice * itemInfo.quantity;
//     }
//   }
  
//   static async _processNPC(npc, nestedData, processedUuids) {
//     if (!nestedData.allNPCs.find(n => n.uuid === npc.uuid)) {
//       nestedData.allNPCs.push(npc);
//     }
//   }

//   static async _createNPCInfo(npcDoc) {
//     const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
//     const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor).catch(() => null) : null;
//     return {
//       uuid: npcDoc.uuid, name: npcDoc.name, img: npcDoc.getFlag("campaign-codex", "image") || actor?.img, type: 'npc',
//       actor: actor ? { uuid: actor.uuid, name: actor.name, ac: actor.system.attributes?.ac?.value || 10, hp: actor.system.attributes?.hp || { value: 0, max: 0 } } : null
//     };
//   }

//   static _removeDuplicates(array) {
//     return array.filter((item, index, self) => index === self.findIndex(t => t.uuid === item.uuid));
//   }
// }
