// Create new file: scripts/npc-dropper.js
import { CampaignCodexTokenPlacement } from './token-placement.js';

export class NPCDropper {
  
  /**
   * Main entry point to drop NPCs to the current scene
   * @param {Array} npcs - Array of NPC objects with actor property
   * @param {Object} options - Options for the drop operation
   */
  static async dropNPCsToScene(npcs, options = {}) {
    if (!canvas.scene) {
      ui.notifications.warn("No scene is currently active!");
      return;
    }

    const npcsWithActors = npcs.filter(npc => npc.actor);
    
    if (npcsWithActors.length === 0) {
      ui.notifications.warn("No NPCs with linked actors found to drop!");
      return;
    }

    // Show selection dialog
    return this._showDropToMapDialog(npcsWithActors, options);
  }

  /**
   * Shows the NPC selection dialog
   * @param {Array} npcs - NPCs to show in dialog
   * @param {Object} options - Dialog options
   */
  static async _showDropToMapDialog(npcs, options = {}) {
    const content = `
      <div class="drop-to-map-dialog">
        <p>Select NPCs to place onto the current scene:</p>
        <div class="npc-selection" style="max-height: 300px; overflow-y: auto;">
          ${npcs.map(npc => `
            <label style="display: flex; align-items: center; margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
              <input type="checkbox" name="selected-npcs" value="${npc.actor.uuid}" checked style="margin-right: 8px;">
              <img src="${npc.img}" alt="${npc.name}" style="width: 32px; height: 32px; border-radius: 4px; margin-right: 8px;">
              <span style="font-weight: 600;">${npc.name}</span>
              ${npc.actor.type === 'character' ? '<span style="margin-left: 8px; font-size: 10px; background: #28a745; color: white; padding: 2px 6px; border-radius: 10px;">PLAYER</span>' : ''}
            </label>
          `).join('')}
        </div>
        ${options.showHiddenToggle !== false ? `
          <div style="margin-top: 12px;">
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" name="start-hidden">
              <span>Start tokens hidden</span>
            </label>
          </div>
        ` : ''}
        <div style="margin-top: 12px; padding: 12px; background: #e8f5e8; border-left: 4px solid #28a745; border-radius: 4px; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 4px;">
            <i class="fas fa-magic" style="color: #28a745; margin-right: 4px;"></i>
            Professional Token Placement
          </div>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            <li><strong>Visual Previews:</strong> See tokens before placing</li>
            <li><strong>Drag & Position:</strong> Move tokens to exact spots</li>
            <li><strong>Rotate:</strong> Scroll wheel to rotate tokens</li>
            <li><strong>Grid Snap:</strong> Shift+click to disable snapping</li>
            <li><strong>Skip Tokens:</strong> Right-click to skip unwanted NPCs</li>
          </ul>
        </div>
      </div>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: options.title || "Drop NPCs to Map",
        content: content,
        buttons: {
          drop: {
            icon: '<i class="fas fa-map"></i>',
            label: "Start Placing",
            callback: async (html) => {
              const selectedUuids = [];
              html.find('input[name="selected-npcs"]:checked').each(function() {
                selectedUuids.push(this.value);
              });
              
              const startHidden = html.find('input[name="start-hidden"]').prop('checked');
              
              if (selectedUuids.length > 0) {
                const result = await this._startTokenPlacement(selectedUuids, {
                  startHidden,
                  ...options
                });
                resolve(result);
              } else {
                ui.notifications.warn("No NPCs selected!");
                resolve({ success: 0, failed: 0, imported: 0 });
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "drop"
      }).render(true);
    });
  }

  /**
   * Starts the token placement workflow using Foundry's TokenPlacement system
   * @param {Array} actorUuids - UUIDs of actors to place
   * @param {Object} options - Placement options
   */
  static async _startTokenPlacement(actorUuids, options = {}) {
    const { startHidden = false } = options;
    
    // Prepare actors (import from compendiums if needed)
    const preparedActors = [];
    const droppedCount = { success: 0, failed: 0, imported: 0 };
    
    ui.notifications.info(`Preparing ${actorUuids.length} NPCs for placement...`);
    
    for (const actorUuid of actorUuids) {
      try {
        let actor = await fromUuid(actorUuid);
        
        // Always import from compendium if needed
        if (actor && actor.pack) {
          console.log(`Campaign Codex | Importing actor ${actor.name} from compendium`);
          const importedActors = await Actor.createDocuments([actor.toObject()]);
          actor = importedActors[0];
          droppedCount.imported++;
        }
        
        if (actor) {
          preparedActors.push(actor);
        } else {
          console.warn(`Campaign Codex | Could not resolve actor: ${actorUuid}`);
          droppedCount.failed++;
        }
      } catch (error) {
        console.error(`Campaign Codex | Error preparing actor ${actorUuid}:`, error);
        droppedCount.failed++;
      }
    }
    
    if (preparedActors.length === 0) {
      ui.notifications.warn("No actors could be prepared for placement!");
      return droppedCount;
    }
    
    // Use Foundry's TokenPlacement system
    return this._useTokenPlacement(preparedActors, { startHidden, ...options }, droppedCount);
  }

  /**
   * Uses Foundry's TokenPlacement system for interactive placement
   * @param {Array} actors - Prepared actors to place
   * @param {Object} options - Placement options
   * @param {Object} droppedCount - Running count of results
   */
  static async _useTokenPlacement(actors, options, droppedCount) {
    const { startHidden = false } = options;
    
    try {
      ui.notifications.info(`Click on the canvas to place ${actors.length} NPCs. Drag to position, scroll to rotate, click to confirm, right-click to skip.`);
      
      // Create prototype tokens for placement
      const prototypeTokens = actors.map(actor => actor.prototypeToken);
      
      // Use Foundry's TokenPlacement system
      const placements = await CampaignCodexTokenPlacement.place({
        tokens: prototypeTokens
      });
      
      if (!placements || placements.length === 0) {
        ui.notifications.info("Token placement cancelled.");
        return droppedCount;
      }
      
      // Prepare token data for creation
      const tokensData = [];
      
      for (const placement of placements) {
        try {
          const actor = placement.prototypeToken.actor;
          
          // Apply hidden state if requested
          if (startHidden) {
            placement.hidden = true;
          }
          
          // Handle appended numbers for unlinked tokens
          const appendNumber = !placement.prototypeToken.actorLink && placement.prototypeToken.appendNumber;
          
          // Remove the prototypeToken from placement for getTokenDocument
          delete placement.prototypeToken;
          
          // Get token document data
          const tokenDocument = await actor.getTokenDocument(placement);
          
          // Adjust appended numbers if needed
          if (appendNumber) {
            CampaignCodexTokenPlacement.adjustAppendedNumber(tokenDocument, placement);
          }
          
          tokensData.push(tokenDocument.toObject());
          droppedCount.success++;
          
        } catch (error) {
          console.error(`Campaign Codex | Error processing placement:`, error);
          droppedCount.failed++;
        }
      }
      
      // Create all tokens at once
      if (tokensData.length > 0) {
        await canvas.scene.createEmbeddedDocuments("Token", tokensData);
      }
      
      this._showResults(droppedCount);
      return droppedCount;
      
    } catch (error) {
      console.error(`Campaign Codex | Error in TokenPlacement:`, error);
      ui.notifications.error("Token placement failed. Check console for details.");
      droppedCount.failed += actors.length;
      return droppedCount;
    }
  }

  /**
   * Shows result notifications
   * @param {Object} droppedCount - Results object
   */
  static _showResults(droppedCount) {
    let message = `Dropped ${droppedCount.success} NPCs to scene`;
    if (droppedCount.imported > 0) {
      message += ` (imported ${droppedCount.imported} from compendiums)`;
    }
    if (droppedCount.failed > 0) {
      message += `. ${droppedCount.failed} failed.`;
    }
    
    if (droppedCount.success > 0) {
      ui.notifications.info(message);
    } else {
      ui.notifications.warn("No NPCs were successfully dropped to the scene.");
    }
  }

  /**
   * Quick drop method - drops all NPCs without dialog, uses placement system
   * @param {Array} npcs - Array of NPC objects
   * @param {Object} options - Drop options
   */
  static async quickDrop(npcs, options = {}) {
    if (!canvas.scene) {
      ui.notifications.warn("No scene is currently active!");
      return;
    }

    const npcsWithActors = npcs.filter(npc => npc.actor);
    
    if (npcsWithActors.length === 0) {
      ui.notifications.warn("No NPCs with linked actors found to drop!");
      return;
    }

    const actorUuids = npcsWithActors.map(npc => npc.actor.uuid);
    
    return this._startTokenPlacement(actorUuids, {
      startHidden: false,
      ...options
    });
  }
}