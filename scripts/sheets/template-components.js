// Enhanced Template component system for Campaign Codex
export class TemplateComponents {


  // Add this new method to the TemplateComponents class
  static richTextSection(label, icon, enrichedValue, editlocation) {
    if (!game.user.isGM)     return `
      <div class="form-section" name="proseedited">
        <label class="form-label">
          <i class="${icon}"></i>
          ${label}
        </label>
      ${enrichedValue}
      </div>
    `;


    return `
      <div class="form-section" name="proseedited">
        <label class="form-label">
          <i class="${icon}"></i>
          ${label}
          <a class="cc-edit-${editlocation}" title="Edit"><i class="fas fa-edit" style="margin-left: 8px; cursor: pointer;"></i></a>
        </label>
      ${enrichedValue}
      </div>
    `;
  }
  
  // Standard form section
  static formSection(label, icon, name, placeholder, value = "", rows = 4) {
    return `
      <div class="form-section">
        <label class="form-label">
          <i class="${icon}"></i>
          ${label}
        </label>
        <textarea name="${name}" class="form-textarea" rows="${rows}" placeholder="${placeholder}">${value}</textarea>
      </div>
    `;
  }

  // Drop zone component
  static dropZone(type, icon, title, description) {
    return `
      <div class="drop-zone" data-drop-type="${type}">
        <div class="drop-content">
          <i class="${icon}"></i>
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
      </div>
    `;
  }

  // Entity grid component
  static entityGrid(entities, type, showActorButton = false) {
    if (!entities || entities.length === 0) {
      return this.emptyState(type);
    }

    return `
      <div class="entity-grid">
        ${entities.map(entity => this.entityCard(entity, type, showActorButton)).join('')}
      </div>
    `;
  }

  // Individual entity card with enhanced source tracking
  static entityCard(entity, type, showActorButton = false) {
    const actorButton = showActorButton && entity.actor ? `
      <button type="button" class="action-btn open-actor" data-actor-uuid="${entity.actor.uuid}" title="Open Actor Sheet">
        <i class="fas fa-user"></i>
      </button>
    ` : '';

    // Determine source-based styling and remove button behavior
    const isShopSource = entity.source === 'shop';
    const isDirectSource = entity.source === 'direct';
    const sourceAttr = entity.source ? `data-source="${entity.source}"` : '';
    
    // Handle remove button based on source
    let removeButton = '';
    if (isShopSource && (type === 'location' || type === 'npc')) {
      // Shop-sourced items cannot be removed directly
      const entityTypeName = type === 'location' ? 'shop-based locations' : 'entry NPCs';
      removeButton = `
        <button type="button" class="action-btn remove-${type}" data-${type}-uuid="${entity.uuid}" title="Cannot remove ${entityTypeName} directly" style="opacity: 0.3; cursor: not-allowed; background: #dc3545; color: white; border-color: #dc3545;">
          <i class="fas fa-ban"></i>
        </button>
      `;
    } else {
      // Normal remove button
      removeButton = `
        <button type="button" class="action-btn remove-${type}" data-${type}-uuid="${entity.uuid}" title="Remove ${type}">
          <i class="fas fa-times"></i>
        </button>
      `;
    }

    return `
      <div class="entity-card ${type}-card" ${sourceAttr}>
        <div class="entity-image">
          <img src="${entity.img}" alt="${entity.name}">
        </div>
        <div class="entity-content">
          <h4 class="entity-name">${entity.name}</h4>
          <div class="entity-meta">
            ${entity.meta || `<span class="entity-type">${type}</span>`}
          </div>
          ${entity.locations && entity.locations.length > 0 ? `
            <div class="entity-locations">
              <i class="fas fa-map-marker-alt"></i>
              ${entity.locations.map(loc => `<span class="location-tag">${loc}</span>`).join('')}
            </div>
          ` : ''}
          ${entity.shops && entity.shops.length > 0 ? `
            <div class="entity-locations shop-tags">
              <i class="fa-book-open"></i>
              ${entity.shops.map(shop => `<span class="location-tag shop-tag">${shop}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="entity-actions">
          <button type="button" class="action-btn open-${type}" data-${type}-uuid="${entity.uuid}" title="Open ${type}">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${actorButton}
          ${removeButton}
        </div>
      </div>
    `;
  }

  // Empty state component
  static emptyState(type) {
    const icons = {
      location: 'fas fa-map-marker-alt',
      shop: 'fas fa-book-open',
      npc: 'fas fa-users',
      associate: 'fas fa-users',
      item: 'fas fa-boxes'
    };

    const messages = {
      location: 'No Locations',
      shop: 'No Entries', 
      npc: 'No NPCs',
      associate: 'No Associates',
      item: 'No Items'
    };

    const descriptions = {
      location: 'Drag location journals here to add them',
      shop: 'Drag entry journals here to add them',
      npc: 'Drag NPCs here to add them',
      associate: 'Drag NPCs here to create relationships',
      item: 'Drag items here to add to inventory'
    };

    return `
      <div class="empty-state">
        <i class="${icons[type] || 'fas fa-question'}"></i>
        <h3>${messages[type] || 'No Items'}</h3>
        <p>${descriptions[type] || 'Drag items here'}</p>
      </div>
    `;
  }

  // Content header with optional button
  static contentHeader(icon, title, button = null) {
    return `
      <div class="content-header">
        <h2><i class="${icon}"></i> ${title}</h2>
        ${button || ''}
      </div>
    `;
  }

  // Actor link card component
  static actorLinkCard(actor, showActions = true) {
    const actions = showActions ? `
      <div class="actor-actions">
        <button type="button" class="action-btn open-actor" data-actor-uuid="${actor.uuid}" title="Open Actor Sheet">
          <i class="fas fa-external-link-alt"></i>
        </button>
        <button type="button" class="action-btn remove-actor" title="Unlink Actor">
          <i class="fas fa-unlink"></i>
        </button>
      </div>
    ` : '';

    return `
      <div class="linked-actor-card">
        <div class="actor-image">
          <img src="${actor.img}" alt="${actor.name}">
        </div>
        <div class="actor-content">
          <h4 class="actor-name">${actor.name}</h4>
          <div class="actor-stats-grid">
            <div class="stat-item">
              <span class="stat-label">AC</span>
              <span class="stat-value">${actor.ac}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">HP</span>
              <span class="stat-value">${actor.hp.value}/${actor.hp.max}</span>
            </div>
          </div>
        </div>
        ${actions}
      </div>
    `;
  }


static inventoryTable(inventory, isLootMode = false) {
  if (!inventory || inventory.length === 0) {
    return this.emptyState('item');
  }

  const priceColumns = isLootMode ? '' : `
    <div>Base Price</div>
    <div>Final Price</div>
  `;

  const tableHeader = `
    <div class="table-header">
      <div>Image</div>
      <div>Item Name</div>
      ${priceColumns}
      <div>Quantity</div>
      <div>Actions</div>
    </div>
  `;

  const inventoryRows = inventory.map(item => {
    const priceColumns = isLootMode ? '' : `
      <div class="item-base-price">
        ${item.basePrice} ${item.currency}
      </div>
      <div class="item-final-price">
        <input type="number" class="price-input" data-item-uuid="${item.itemUuid}" value="${item.finalPrice}" step="0.01" min="0">
        <span class="price-currency">${item.currency}</span>
      </div>
    `;

    const gridColumns = isLootMode ? 
      'grid-template-columns: 60px 1fr 120px 100px' : 
      'grid-template-columns: 60px 1fr 100px 120px 120px 100px';

    return `
      <div class="inventory-item" draggable="true" data-item-uuid="${item.itemUuid}" data-item-name="${item.name}" style="${gridColumns}">
        <div class="item-image">
          <img src="${item.img}" alt="${item.name}">
        </div>
        <div class="item-details">
          <div class="item-name">${item.name}</div>
        </div>
        ${priceColumns}
        <div class="quantity-control">
          <button type="button" class="quantity-btn quantity-decrease" data-item-uuid="${item.itemUuid}">
            <i class="fas fa-minus"></i>
          </button>
          <input type="number" class="quantity-input" data-item-uuid="${item.itemUuid}" value="${item.quantity}" min="0">
          <button type="button" class="quantity-btn quantity-increase" data-item-uuid="${item.itemUuid}">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="item-actions">
          <button type="button" class="action-btn open-item" data-item-uuid="${item.itemUuid}" title="Open Item Sheet">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button type="button" class="action-btn send-to-player" data-item-uuid="${item.itemUuid}" title="Send to Player">
            <i class="fas fa-paper-plane"></i>
          </button>
          <button type="button" class="action-btn remove-item" data-item-uuid="${item.itemUuid}" title="Remove Item">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const headerGridColumns = isLootMode ? 
    'grid-template-columns: 60px 1fr 120px 100px' : 
    'grid-template-columns: 60px 1fr 100px 120px 120px 100px';

  return `
    <div class="inventory-table">
      <div class="table-header" style="${headerGridColumns}">
        <div>Image</div>
        <div>Item Name</div>
        ${isLootMode ? '' : '<div>Base Price</div><div>Final Price</div>'}
        <div>Quantity</div>
        <div>Actions</div>
      </div>
      ${inventoryRows}
    </div>
  `;
}



  // // Shop inventory table
  // static inventoryTable(inventory) {
  //   if (!inventory || inventory.length === 0) {
  //     return this.emptyState('item');
  //   }

  //   return `
  //     <div class="inventory-table">
  //       <div class="table-header">
  //         <div>Image</div>
  //         <div>Item Name</div>
  //         <div>Base Price</div>
  //         <div>Quantity</div>
  //         <div>Final Price</div>
  //         <div>Actions</div>
  //       </div>
  //       ${inventory.map(item => `
  //         <div class="inventory-item" draggable="true" data-item-uuid="${item.itemUuid}" data-item-name="${item.name}">
  //           <div class="item-image">
  //             <img src="${item.img}" alt="${item.name}">
  //           </div>
  //           <div class="item-details">
  //             <div class="item-name">${item.name}</div>
  //           </div>
  //           <div class="item-base-price">
  //             ${item.basePrice} ${item.currency}
  //           </div>
  //           <div class="quantity-control">
  //             <button type="button" class="quantity-btn quantity-decrease" data-item-uuid="${item.itemUuid}">
  //               <i class="fas fa-minus"></i>
  //             </button>
  //             <input type="number" class="quantity-input" data-item-uuid="${item.itemUuid}" value="${item.quantity}" min="0">
  //             <button type="button" class="quantity-btn quantity-increase" data-item-uuid="${item.itemUuid}">
  //               <i class="fas fa-plus"></i>
  //             </button>
  //           </div>
  //           <div class="item-final-price">
  //             <input type="number" class="price-input" data-item-uuid="${item.itemUuid}" value="${item.finalPrice}" step="0.01" min="0">
  //             <span class="price-currency">${item.currency}</span>
  //           </div>
  //           <div class="item-actions">
  //             <button type="button" class="action-btn open-item" data-item-uuid="${item.itemUuid}" title="Open Item Sheet">
  //               <i class="fas fa-external-link-alt"></i>
  //             </button>
  //             <button type="button" class="action-btn send-to-player" data-item-uuid="${item.itemUuid}" title="Send to Player">
  //               <i class="fas fa-paper-plane"></i>
  //             </button>
  //             <button type="button" class="action-btn remove-item" data-item-uuid="${item.itemUuid}" title="Remove Item">
  //               <i class="fas fa-trash"></i>
  //             </button>
  //           </div>
  //         </div>
  //       `).join('')}
  //     </div>
  //   `;
  // }

  static async createPlayerSelectionDialog(itemName, onPlayerSelected) {
    // Get all actors that are player characters (type "character")
    const playerCharacters = game.actors.filter(actor => actor.type === "character");

    if (playerCharacters.length === 0) {
      ui.notifications.warn("No player characters found");
      return;
    }

    const content = `
      <div class="player-selection">
        <p>Send <strong>${itemName}</strong> to which player character?</p>
        <div class="player-list">
          ${playerCharacters.map(char => {
            // Check if character has an assigned user
          const assignedUser = game.users.find(u => u.character?.uuid === char.uuid); // Change from id to uuid
            const userInfo = assignedUser ? ` (${assignedUser.name})` : ' (Unassigned)';
            
            return `
              <div class="player-option" data-actor-uuid="${char.uuid}">
                <img src="${char.img}" alt="${char.name}" style="width: 32px; height: 32px; border-radius: 4px; margin-right: 8px;">
                <div class="player-info">
                  <span class="character-name">${char.name}</span>
                  <span class="user-info">${userInfo}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    new Dialog({
      title: "Send Item to Player Character",
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        html.find('.player-option').click(async (event) => {
          const actorUuid = event.currentTarget.dataset.actorUuid;
          const actor = await fromUuid(actorUuid);
          if (actor) {
            onPlayerSelected(actor);
          }
          html.closest('.dialog').find('.dialog-button.cancel button').click();
        });
      }
    }).render(true);
  }

  // Markup control component
  static markupControl(markup) {
    return `
      <div class="markup-control">
        <h3><i class="fas fa-percentage"></i> Global Price Markup</h3>
        <div class="markup-input-group">
          <input type="number" class="markup-input" value="${markup}" min="0" max="10" step="0.1">
          <span class="markup-label">x base price</span>
        </div>
        <p class="markup-help">Items without custom prices will use base price × markup</p>
      </div>
    `;
  }

  // Info banner component
  static infoBanner(message) {
    return `
      <div class="info-banner">
        <i class="fas fa-info-circle"></i>
        <p>${message}</p>
      </div>
    `;
  }
}