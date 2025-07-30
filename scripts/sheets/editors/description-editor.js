export class DescriptionEditor extends FormApplication {

  constructor(document, options) {
    super(document, options);
    this.document = document; // The journal entry we are editing
    this.fieldName = options.field;

  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Edit Description",
      template: "modules/campaign-codex/templates/editors/description-editor.html",
      width: 720,
      height: 600,
      resizable: true,
      classes: ["dialog", "journal-editor", "sheet", "journal-sheet", "journal-entry", "journal-entry-page", "text" ,"cc-editor"],
      closeOnSubmit: true, // The window will close after saving
    });
  }

  /**
   * Provide the data to the HTML template.
   */
  getData() {
    const dataPath = 'flags.campaign-codex.data.${this.fieldName}';
    const content = foundry.utils.getProperty(this.object, dataPath) || "";
    return {
      description: content 
    };
  }

  /**
   * This method is called when the form is rendered.
   * We use it to activate the rich text editor.
   */
  activateListeners(html) {
    super.activateListeners(html);

    const targetElement = html.find('div[name="description"]')[0];
    const dataPath = 'flags.campaign-codex.data.${this.fieldName}';
    const content = foundry.utils.getProperty(this.object, dataPath) || "";
    
    // Create the editor instance and store it on the class
    TextEditor.create({
      target: targetElement,
      engine: 'prosemirror',
      content: content
    }).then(editor => {
      this.editor = editor;
    });
  }

  /**
   * This method is called when the form is submitted.
   * It handles saving the data back to the document.
   */
  async _updateObject(event, formData) {
    // Get the latest content from the editor's div in the form
    const fnamed = this.fieldName;
    const newContent = this.element.find('div[name="description"]').html();
    const dataPath = 'flags.campaign-codex.data.'+fnamed;
    // Update the document flag
    await this.document.update({
      [dataPath]: newContent
    });
    
    // Re-render the parent NPC sheet to show the changes
    this.document.sheet.render(true);
  }


  async close(options = {}) {
    if (this.editor && typeof this.editor.destroy === 'function') {
      this.editor.destroy();
    }
    return super.close(options);
  }
}