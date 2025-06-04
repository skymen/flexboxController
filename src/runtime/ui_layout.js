/**
 * Enhanced UI Layout System for Construct 3 with Full Flex Support
 * Implements flex-grow, flex-shrink, flex-basis, align-self, and justify-self
 */

class UILayout {
  constructor(runtime) {
    this.runtime = runtime;
    // Map to store registered classes and their styles
    this.registeredClasses = new Map();
    this.cachedBboxes = new WeakMap();
  }

  /**
   * Register a class with its style definition
   * @param {string} className - Name of the class
   * @param {string} styleString - CSS-like style string
   */
  registerClass(className, styleString) {
    const parsedStyle = this.parseStyle(styleString);
    this.registeredClasses.set(className, parsedStyle);
  }

  getClassStyle(className) {
    if (!this.registeredClasses.has(className)) {
      this.registerClass(className, "");
    }
    return this.registeredClasses.get(className);
  }

  /**
   * Parses CSS-like text into a style object
   * Enhanced to support flex properties and shorthand
   *
   * @param {string} cssText - CSS-like text with properties
   * @returns {Object} Object containing computed style and important properties
   */
  parseStyle(cssText) {
    if (!cssText) return { computedStyle: {}, importantProperties: [] };

    const computedStyle = {};
    const importantProperties = [];

    // Split the input text by line breaks
    const lines = cssText.split("\n").join(";").split(";");

    for (let line of lines) {
      // Remove any whitespace and optional semicolon
      line = line.trim();
      if (!line) continue;

      if (line.endsWith(";")) {
        line = line.slice(0, -1);
      }

      // Split by the first colon
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const property = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      if (!property || !value) continue;

      // Check for !important
      const isImportant = value.includes("!important");
      if (isImportant) {
        value = value.replace(/\s*!important\s*$/, "").trim();
        // Convert kebab-case to camelCase for the important list
        importantProperties.push(this.kebabToCamel(property));
      }

      // Convert kebab-case to camelCase if needed
      const camelProperty = this.kebabToCamel(property);

      // Special handling for flex shorthand
      if (camelProperty === "flex") {
        this.parseFlexShorthand(value, computedStyle);
        continue;
      }

      // Convert value if needed (handling numbers)
      computedStyle[camelProperty] = this.convertValue(value);
    }

    return {
      computedStyle,
      importantProperties,
    };
  }

  removePropertyFromStyle(style, property) {
    const camelProperty = this.kebabToCamel(property);
    if (style.computedStyle.hasOwnProperty(camelProperty)) {
      delete style.computedStyle[camelProperty];
    }
    const importantIndex = style.importantProperties.indexOf(camelProperty);
    if (importantIndex !== -1) {
      style.importantProperties.splice(importantIndex, 1);
    }
  }

  setPropertyInStyle(style, property, value) {
    this.removePropertyFromStyle(style, property);
    if (!value) {
      return;
    }
    const extraStyle = this.parseStyle(`${property}: ${value};`);

    style.computedStyle = {
      ...style.computedStyle,
      ...extraStyle.computedStyle,
    };
    style.importantProperties = [
      ...style.importantProperties,
      ...extraStyle.importantProperties,
    ];
  }

  /**
   * Parse flex shorthand property into individual flex properties
   * @param {string} value - The flex shorthand value
   * @param {Object} computedStyle - The style object to update
   */
  parseFlexShorthand(value, computedStyle) {
    const parts = value.split(/\s+/);

    // Handle different formats of the flex shorthand
    if (parts.length === 1) {
      // Single value can be either a number (flex-grow) or a keyword
      if (parts[0] === "auto") {
        computedStyle["flexGrow"] = 1;
        computedStyle["flexShrink"] = 1;
        computedStyle["flexBasis"] = "auto";
      } else if (parts[0] === "none") {
        computedStyle["flexGrow"] = 0;
        computedStyle["flexShrink"] = 0;
        computedStyle["flexBasis"] = "auto";
      } else if (parts[0] === "initial") {
        computedStyle["flexGrow"] = 0;
        computedStyle["flexShrink"] = 1;
        computedStyle["flexBasis"] = "auto";
      } else {
        // Assume it's a flex-grow value
        computedStyle["flexGrow"] = this.convertValue(parts[0]);
        computedStyle["flexShrink"] = 1;
        computedStyle["flexBasis"] = "0";
      }
    } else if (parts.length === 2) {
      // Two values: flex-grow and flex-shrink or flex-basis
      computedStyle["flexGrow"] = this.convertValue(parts[0]);

      // Check if second part is a number (flex-shrink) or has units (flex-basis)
      if (/^\d+(\.\d+)?$/.test(parts[1])) {
        computedStyle["flexShrink"] = this.convertValue(parts[1]);
        computedStyle["flexBasis"] = "0";
      } else {
        computedStyle["flexShrink"] = 1;
        computedStyle["flexBasis"] = parts[1];
      }
    } else if (parts.length >= 3) {
      // Three values: flex-grow, flex-shrink, and flex-basis
      computedStyle["flexGrow"] = this.convertValue(parts[0]);
      computedStyle["flexShrink"] = this.convertValue(parts[1]);
      computedStyle["flexBasis"] = parts[2];
    }
  }

  /**
   * Converts kebab-case to camelCase (e.g., min-width → minWidth)
   * @param {string} str - Property name to convert
   * @returns {string} camelCase property name
   */
  kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (match, group) => group.toUpperCase());
  }

  /**
   * Converts string values to appropriate types
   * @param {string} value - Value to convert
   * @returns {string|number} Converted value
   */
  convertValue(value) {
    // If it's a pure number (no units), convert to number type
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Special case for zero with units - just return 0
    if (/^0(px|%|em|rem|pt|vh|vw)$/.test(value)) {
      return 0;
    }

    // Otherwise keep as string (for percentages, auto, etc.)
    return value;
  }

  /**
   * Merges multiple style objects while respecting !important declarations
   *
   * @param {Array} styleObjects - Array of style objects from parseStyle
   * @returns {Object} Final merged style object
   */
  mergeStyles(styleObjects) {
    if (!styleObjects || !Array.isArray(styleObjects)) return {};

    // Track properties that have been applied with !important
    const appliedImportantProps = new Set();

    // Final computed style to apply to the node
    const finalStyle = {};

    // Process each style object in order (like CSS cascade)
    for (const styleObj of styleObjects) {
      if (!styleObj || !styleObj.computedStyle) continue;

      const { computedStyle, importantProperties = [] } = styleObj;

      // Process each property in the current style
      for (const [prop, value] of Object.entries(computedStyle)) {
        const isCurrentPropImportant = importantProperties.includes(prop);

        // Apply the property if:
        // 1. This property hasn't been applied yet as !important, OR
        // 2. This property is being applied with !important now
        if (!appliedImportantProps.has(prop) || isCurrentPropImportant) {
          finalStyle[prop] = value;

          // Track if we're applying this as important
          if (isCurrentPropImportant) {
            appliedImportantProps.add(prop);
          }
        }
      }
    }

    return finalStyle;
  }

  /**
   * Process an instance and its children following correct cascade order
   * @param {WorldInstance} instance - The instance to process
   */
  processInstance(instance) {
    // 1. Calculate and apply styles to current instance
    const instanceAngle = instance.angleDegrees;
    instance.angleDegrees = 0; // Temporarily reset angle for layout calculations
    // this.invalidateInstanceBBox(instance);
    const styles = this.getInstanceStyles(instance);
    this.applyStylesToInstance(instance, styles);

    // 2. Get layout properties for current instance
    const layoutProps = this.getLayoutProperties(instance);

    if (!instance.getParent()) {
      layoutProps.position = "relative";
    }

    // 3. Separate children into in-flow and out-of-flow
    const children = [...instance.children()];
    const inFlowChildren = [];
    const outOfFlowChildren = [];
    const percentSizedChildren = [];

    for (const child of children) {
      // Skip non-visible or explicitly disabled children
      if (!child.isVisible || child.__flexbox_ui_element?.enabled === false) {
        continue;
      }

      // Apply preliminary styles to determine positioning
      const childStyles = this.getInstanceStyles(child);

      // Check if child has percentage-based sizing
      if (this.hasPercentageSizing(childStyles)) {
        percentSizedChildren.push(child);
      }

      const childPosition = childStyles.position || "relative";
      if (childPosition === "absolute" || childPosition === "anchor") {
        outOfFlowChildren.push(child);
      } else {
        inFlowChildren.push(child);
      }
    }

    // 4. FIRST recursively process all in-flow children to establish their base sizes
    for (const child of inFlowChildren) {
      this.processInstance(child);
    }

    // 5. THEN apply normal flow layout now that children are properly sized
    if (
      layoutProps.display &&
      layoutProps.position !== "absolute" &&
      layoutProps.position !== "anchor"
    ) {
      this.applyNormalFlowLayout(instance, layoutProps, inFlowChildren);
    }

    // 6. Apply fit-content sizing if needed (after children are sized)
    if (layoutProps.fitContent) {
      this.applyFitContentSizing(instance, layoutProps);

      // 6.1 If size changed and we have percentage-sized children, reapply their sizing
      if (percentSizedChildren.length > 0) {
        for (const child of percentSizedChildren) {
          // Reapply the percentage sizing now that parent dimensions are finalized
          this.applyPercentageSizing(child);
        }

        // 6.2 And reapply layout to ensure positions are correct with new sizes
        if (
          layoutProps.display &&
          layoutProps.position !== "absolute" &&
          layoutProps.position !== "anchor"
        ) {
          this.applyNormalFlowLayout(instance, layoutProps, inFlowChildren);
        }
      }

      // 6.3 Reapply normal flow layout if the container size changed and we have flex children
      else if (
        layoutProps.display &&
        layoutProps.position !== "absolute" &&
        layoutProps.position !== "anchor" &&
        this.hasFlexChildren(inFlowChildren)
      ) {
        this.applyNormalFlowLayout(instance, layoutProps, inFlowChildren);
      }
    }

    // 7. Process out-of-flow positioned elements AFTER regular flow
    for (const child of outOfFlowChildren) {
      // Process the out-of-flow child first to ensure its size is calculated
      this.processInstance(child);

      // Now position it relative to its container or anchor target
      this.applyOutOfFlowLayout(child);
    }

    instance.angleDegrees = instanceAngle;
  }

  /**
   * Check if any children have flex properties set
   * @param {Array} children - Array of child instances
   * @returns {boolean} True if any child has flex properties
   */
  hasFlexChildren(children) {
    return children.some((child) => {
      const styles = this.getInstanceStyles(child);
      return (
        (styles.flexGrow && styles.flexGrow > 0) ||
        typeof styles.flexShrink !== "undefined" ||
        (styles.flexBasis && styles.flexBasis !== "auto")
      );
    });
  }

  /**
   * Get styles for an instance based on its inline style and classes
   * @param {WorldInstance} instance - The instance to get styles for
   * @returns {Object} Merged style object
   */
  getInstanceStyles(instance) {
    if (!instance.__flexbox_ui_element) return {};
    if (instance.__flexbox_ui_element._computedStyle !== undefined) {
      return instance.__flexbox_ui_element._computedStyle;
    }
    const stylesToMerge = [];

    // Get classes from instance variables
    const classes = instance.__flexbox_ui_element.classes || [];

    // Add styles from each class
    for (const className of classes) {
      if (this.registeredClasses.has(className)) {
        stylesToMerge.push(this.registeredClasses.get(className));
      }
    }

    // Add inline style if present
    const inlineStyle = instance.__flexbox_ui_element.style || {};
    if (inlineStyle) {
      stylesToMerge.push(inlineStyle);
    }

    // Merge all styles
    instance.__flexbox_ui_element._computedStyle =
      this.mergeStyles(stylesToMerge);
    return instance.__flexbox_ui_element._computedStyle;
  }

  /**
   * Check if an element has percentage-based sizing
   * @param {Object} styles - Element styles
   * @returns {boolean} True if element has percentage sizing
   */
  hasPercentageSizing(styles) {
    // Check for percentWidth/percentHeight properties
    if ("percentWidth" in styles || "percentHeight" in styles) {
      return true;
    }

    // Check for width/height with percentage strings
    if (
      styles.width &&
      typeof styles.width === "string" &&
      styles.width.endsWith("%")
    ) {
      return true;
    }

    if (
      styles.height &&
      typeof styles.height === "string" &&
      styles.height.endsWith("%")
    ) {
      return true;
    }

    // Check for flex-basis with percentage
    if (
      styles.flexBasis &&
      typeof styles.flexBasis === "string" &&
      styles.flexBasis.endsWith("%")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Apply percentage-based sizing to an element
   * @param {WorldInstance} instance - The instance to size
   */
  applyPercentageSizing(instance) {
    if (!instance.getParent()) {
      return;
    }

    const styles = this.getInstanceStyles(instance);
    if (!styles) return;
    const parent = instance.getParent();
    const parentBoxModel = this.getBoxModel(parent);
    const isHorizontal = styles.display === "horizontal";
    const isVertical = styles.display === "vertical" || !styles.display;

    // Apply width percentages if present
    if (
      "percentWidth" in styles ||
      (styles.width &&
        typeof styles.width === "string" &&
        styles.width.endsWith("%"))
    ) {
      const percentValue =
        "percentWidth" in styles
          ? styles.percentWidth
          : parseFloat(styles.width) || 0;

      if (percentValue >= 0) {
        const availableWidth =
          this.getInstanceWidth(parent) -
          parentBoxModel.padding.left -
          parentBoxModel.padding.right -
          parentBoxModel.border.left -
          parentBoxModel.border.right;

        this.setInstanceWidth(instance, (availableWidth * percentValue) / 100);
      }
    }

    // Apply height percentages if present
    if (
      "percentHeight" in styles ||
      (styles.height &&
        typeof styles.height === "string" &&
        styles.height.endsWith("%"))
    ) {
      const percentValue =
        "percentHeight" in styles
          ? styles.percentHeight
          : parseFloat(styles.height) || 0;

      if (percentValue >= 0) {
        const availableHeight =
          this.getInstanceHeight(parent) -
          parentBoxModel.padding.top -
          parentBoxModel.padding.bottom -
          parentBoxModel.border.top -
          parentBoxModel.border.bottom;

        this.setInstanceHeight(
          instance,
          (availableHeight * percentValue) / 100
        );
      }
    }

    // Apply flex-basis percentages if appropriate for the main axis
    if (
      styles.flexBasis &&
      typeof styles.flexBasis === "string" &&
      styles.flexBasis.endsWith("%")
    ) {
      const percentValue = parseFloat(styles.flexBasis) || 0;

      if (percentValue >= 0) {
        if (isHorizontal) {
          const availableWidth =
            this.getInstanceWidth(parent) -
            parentBoxModel.padding.left -
            parentBoxModel.padding.right -
            parentBoxModel.border.left -
            parentBoxModel.border.right;

          this.setInstanceWidth(
            instance,
            (availableWidth * percentValue) / 100
          );
        } else if (isVertical) {
          const availableHeight =
            this.getInstanceHeight(parent) -
            parentBoxModel.padding.top -
            parentBoxModel.padding.bottom -
            parentBoxModel.border.top -
            parentBoxModel.border.bottom;

          this.setInstanceHeight(
            instance,
            (availableHeight * percentValue) / 100
          );
        }
      }
    }

    // Apply min/max constraints
    this.applyMinMaxConstraints(instance, styles);
  }

  /**
   * Apply min/max constraints to an instance
   * @param {WorldInstance} instance - The instance to constrain
   * @param {Object} styles - Style object with constraints
   * @returns {Object} Info about which constraints were applied
   */
  applyMinMaxConstraints(instance, styles) {
    const constraints = {
      minWidth: styles.minWidth,
      maxWidth: styles.maxWidth,
      minHeight: styles.minHeight,
      maxHeight: styles.maxHeight,
    };

    let widthConstrained = false;
    let heightConstrained = false;

    // Apply min width constraint
    if (
      constraints.minWidth !== undefined &&
      this.getInstanceWidth(instance) < constraints.minWidth
    ) {
      this.setInstanceWidth(instance, constraints.minWidth);
      widthConstrained = true;
    }

    // Apply max width constraint
    if (
      constraints.maxWidth !== undefined &&
      this.getInstanceWidth(instance) > constraints.maxWidth
    ) {
      this.setInstanceWidth(instance, constraints.maxWidth);
      widthConstrained = true;
    }

    // Apply min height constraint
    if (
      constraints.minHeight !== undefined &&
      this.getInstanceHeight(instance) < constraints.minHeight
    ) {
      this.setInstanceHeight(instance, constraints.minHeight);
      heightConstrained = true;
    }

    // Apply max height constraint
    if (
      constraints.maxHeight !== undefined &&
      this.getInstanceHeight(instance) > constraints.maxHeight
    ) {
      this.setInstanceHeight(instance, constraints.maxHeight);
      heightConstrained = true;
    }

    return { widthConstrained, heightConstrained };
  }

  /**
   * Get computed layout properties from styles
   * @param {WorldInstance} instance - The instance to get layout properties for
   * @returns {Object} Layout properties
   */
  getLayoutProperties(instance) {
    const styles = this.getInstanceStyles(instance);
    return {
      display: styles.display || "vertical", // vertical, horizontal, grid
      position: styles.position || "relative", // relative, absolute, anchor
      gap: styles.gap || 0,
      padding: styles.padding || 0,
      alignItems: styles.alignItems || styles.alignment || "start", // start, center, end
      justifyContent: styles.justifyContent || "start", // start, center, end, space-between, space-around
      columns: styles.columns || 2,
      fitContent: styles.fitContent === "true",
      top: styles.top,
      right: styles.right,
      bottom: styles.bottom,
      left: styles.left,
      // Anchor positioning properties
      anchorTarget: styles.anchorTarget, // ID or instance reference
      anchorPoint: styles.anchorPoint || "center", // Anchor point on target
      selfAnchor: styles.selfAnchor || "center", // Anchor point on self
      anchorOffsetX: styles.anchorOffsetX || 0,
      anchorOffsetY: styles.anchorOffsetY || 0,
    };
  }

  /**
   * Apply normal flow layout (static/relative positioning)
   * @param {WorldInstance} instance - The instance to layout
   * @param {Object} layoutProps - Layout properties
   * @param {Array} children - Children to layout (optional, if already filtered)
   */
  applyNormalFlowLayout(instance, layoutProps, children) {
    // Use provided children or get them if not provided
    const layoutChildren = children || this.getLayoutChildren(instance);

    switch (layoutProps.display) {
      case "vertical":
        this.layoutVertical(instance, layoutProps, layoutChildren);
        break;
      case "horizontal":
        this.layoutHorizontal(instance, layoutProps, layoutChildren);
        break;
      case "grid":
        this.layoutGrid(instance, layoutProps, layoutChildren);
        break;
    }
  }

  /**
   * Apply fit-content sizing to a container based on its children
   * @param {WorldInstance} instance - The container to apply fit-content to
   * @param {Object} layoutProps - Layout properties
   */
  applyFitContentSizing(instance, layoutProps) {
    const children = this.getLayoutChildren(instance);
    const containerBoxModel = this.getBoxModel(instance);

    // Different sizing logic based on display type
    switch (layoutProps.display) {
      case "vertical":
        // Calculate total height and max width
        let totalHeightVertical =
          containerBoxModel.padding.top + containerBoxModel.padding.bottom;
        let maxWidth = 0;

        children.forEach((child, index) => {
          totalHeightVertical += this.getOuterHeight(child);
          if (index < children.length - 1) {
            totalHeightVertical += layoutProps.gap;
          }
          maxWidth = Math.max(maxWidth, this.getOuterWidth(child));
        });

        // Apply new dimensions
        this.setInstanceHeight(
          instance,
          totalHeightVertical +
            containerBoxModel.border.top +
            containerBoxModel.border.bottom
        );
        this.setInstanceWidth(
          instance,
          maxWidth +
            containerBoxModel.padding.left +
            containerBoxModel.padding.right +
            containerBoxModel.border.left +
            containerBoxModel.border.right
        );
        break;

      case "horizontal":
        // Calculate total width and max height
        let totalWidthHorizontal =
          containerBoxModel.padding.left + containerBoxModel.padding.right;
        let maxHeight = 0;

        children.forEach((child, index) => {
          totalWidthHorizontal += this.getOuterWidth(child);
          if (index < children.length - 1) {
            totalWidthHorizontal += layoutProps.gap;
          }
          maxHeight = Math.max(maxHeight, this.getOuterHeight(child));
        });

        // Apply new dimensions
        this.setInstanceWidth(
          instance,
          totalWidthHorizontal +
            containerBoxModel.border.left +
            containerBoxModel.border.right
        );
        this.setInstanceHeight(
          instance,
          maxHeight +
            containerBoxModel.padding.top +
            containerBoxModel.padding.bottom +
            containerBoxModel.border.top +
            containerBoxModel.border.bottom
        );
        break;

      case "grid":
        // Grid is more complex, we need to calculate row/column count
        const columns = layoutProps.columns || 2;
        const rows = Math.ceil(children.length / columns);

        // Find max cell dimensions
        let maxCellWidth = 0;
        let maxCellHeight = 0;

        children.forEach((child) => {
          const childBoxModel = this.getBoxModel(child);

          maxCellWidth = Math.max(
            maxCellWidth,
            this.getInstanceWidth(child) +
              childBoxModel.margin.left +
              childBoxModel.margin.right
          );

          maxCellHeight = Math.max(
            maxCellHeight,
            this.getInstanceHeight(child) +
              childBoxModel.margin.top +
              childBoxModel.margin.bottom
          );
        });

        // Calculate total dimensions
        const totalWidthGrid =
          columns * maxCellWidth +
          (columns - 1) * layoutProps.gap +
          containerBoxModel.padding.left +
          containerBoxModel.padding.right +
          containerBoxModel.border.left +
          containerBoxModel.border.right;

        const totalHeightGrid =
          rows * maxCellHeight +
          (rows - 1) * layoutProps.gap +
          containerBoxModel.padding.top +
          containerBoxModel.padding.bottom +
          containerBoxModel.border.top +
          containerBoxModel.border.bottom;

        // Apply new dimensions
        this.setInstanceWidth(instance, totalWidthGrid);
        this.setInstanceHeight(instance, totalHeightGrid);
        break;
    }
  }

  /**
   * Apply out-of-flow layout (absolute/anchor positioning)
   * @param {WorldInstance} instance - The instance to layout
   */
  applyOutOfFlowLayout(instance) {
    const layoutProps = this.getLayoutProperties(instance);

    switch (layoutProps.position) {
      case "absolute":
        this.positionAbsolute(instance, layoutProps);
        break;
      case "anchor":
        this.positionAnchor(instance, layoutProps);
        break;
    }
  }

  /**
   * Position an element absolutely within its parent
   * @param {WorldInstance} instance - The instance to position
   * @param {Object} layoutProps - Layout properties
   */
  positionAbsolute(instance, layoutProps) {
    if (!instance.getParent()) return;

    const parent = instance.getParent();
    const parentBoxModel = this.getBoxModel(parent);
    const instanceBoxModel = this.getBoxModel(instance);

    // Get content area boundaries (inside padding/border)
    const contentLeft =
      this.getInstanceX(parent) +
      parentBoxModel.padding.left +
      parentBoxModel.border.left;
    const contentTop =
      this.getInstanceY(parent) +
      parentBoxModel.padding.top +
      parentBoxModel.border.top;
    const contentRight =
      this.getInstanceX(parent) +
      this.getInstanceWidth(parent) -
      parentBoxModel.padding.right -
      parentBoxModel.border.right;
    const contentBottom =
      this.getInstanceY(parent) +
      this.getInstanceHeight(parent) -
      parentBoxModel.padding.bottom -
      parentBoxModel.border.bottom;

    // Calculate position based on properties
    let x, y;

    // Handle horizontal positioning
    if (layoutProps.left !== undefined) {
      x = contentLeft + layoutProps.left + instanceBoxModel.margin.left;
    } else if (layoutProps.right !== undefined) {
      x =
        contentRight -
        layoutProps.right -
        this.getInstanceWidth(instance) -
        instanceBoxModel.margin.right;
    } else {
      // Default to left: 0
      x = contentLeft + instanceBoxModel.margin.left;
    }

    // Handle vertical positioning
    if (layoutProps.top !== undefined) {
      y = contentTop + layoutProps.top + instanceBoxModel.margin.top;
    } else if (layoutProps.bottom !== undefined) {
      y =
        contentBottom -
        layoutProps.bottom -
        this.getInstanceHeight(instance) -
        instanceBoxModel.margin.bottom;
    } else {
      // Default to top: 0
      y = contentTop + instanceBoxModel.margin.top;
    }

    // Apply the position
    this.setInstanceX(instance, x);
    this.setInstanceY(instance, y);
  }

  getInstanceBBox(instance) {
    return instance.getBoundingBox();
  }

  getInstanceBBoxCached(instance) {
    if (this.cachedBboxes.has(instance)) {
      return this.cachedBboxes.get(instance);
    }

    // Get the bounding box from the instance
    const bbox = instance.getBoundingBox();

    // Cache the bounding box for future use
    this.cachedBboxes.set(instance, bbox);

    return bbox;
  }

  invalidateInstanceBBox(instance) {
    this.cachedBboxes.delete(instance);
  }

  getInstanceX(instance) {
    return instance.getBoundingBox().left;
  }

  getInstanceY(instance) {
    return instance.getBoundingBox().top;
  }

  setInstanceX(instance, x) {
    let bbox = instance.getBoundingBox();
    instance.x = x + instance.x - bbox.left;
    // this.invalidateInstanceBBox(instance);
  }

  setInstanceY(instance, y) {
    let bbox = instance.getBoundingBox();
    instance.y = y + instance.y - bbox.top;
    // this.invalidateInstanceBBox(instance);
  }

  getInstanceWidth(instance) {
    return instance.getBoundingBox().width;
  }

  getInstanceHeight(instance) {
    return instance.getBoundingBox().height;
  }

  setInstanceWidth(instance, width) {
    if (instance.width === 0) {
      instance.width = width;
      // this.invalidateInstanceBBox(instance);
    }
    let bbox = instance.getBoundingBox();
    instance.width = width * (instance.width / bbox.width);
    // this.invalidateInstanceBBox(instance);
  }

  setInstanceHeight(instance, height) {
    if (instance.height === 0) {
      instance.height = height;
      // this.invalidateInstanceBBox(instance);
    }
    let bbox = instance.getBoundingBox();
    instance.height = height * (instance.height / bbox.height);
    // this.invalidateInstanceBBox(instance);
  }

  /**
   * Position an element using anchor positioning
   * @param {WorldInstance} instance - The instance to position
   * @param {Object} layoutProps - Layout properties
   */
  positionAnchor(instance, layoutProps) {
    let target = null;

    // If no anchor target specified, default to parent
    if (!layoutProps.anchorTarget) {
      target = instance.getParent();
      if (!target) return; // No parent to anchor to
    } else {
      // Find the target element by tag/name
      if (typeof layoutProps.anchorTarget === "string") {
        // Special case: "parent" refers to the parent element
        if (layoutProps.anchorTarget === "parent") {
          target = instance.getParent();
        } else {
          // Look through all objects to find one with matching tag
          for (const objectType of Object.values(this.runtime.objects)) {
            for (const inst of objectType.getAllInstances()) {
              if (inst.hasTags(layoutProps.anchorTarget)) {
                target = inst;
                break;
              }
            }
            if (target) break;
          }
        }
      } else if (
        layoutProps.anchorTarget instanceof this.runtime.objects.WorldInstance
      ) {
        // Direct instance reference
        target = layoutProps.anchorTarget;
      }
    }

    if (!target) return;

    // Ensure we have the current position
    const originalX = this.getInstanceX(instance);
    const originalY = this.getInstanceY(instance);

    // Get anchor points
    const targetPoint = this.getAnchorPoint(target, layoutProps.anchorPoint);
    const selfPoint = this.getAnchorPoint(
      instance,
      layoutProps.selfAnchor,
      true
    );

    // Calculate offset between anchor points
    const offsetX =
      targetPoint.x -
      (originalX + selfPoint.offsetX) +
      layoutProps.anchorOffsetX;
    const offsetY =
      targetPoint.y -
      (originalY + selfPoint.offsetY) +
      layoutProps.anchorOffsetY;

    // Apply position
    this.setInstanceX(instance, originalX + offsetX);
    this.setInstanceY(instance, originalY + offsetY);
  }

  /**
   * Get the coordinates of an anchor point on an instance
   * @param {WorldInstance} instance - The instance
   * @param {string} anchor - The anchor point name
   * @param {boolean} returnOffset - If true, return offset from instance origin instead of absolute coordinates
   * @returns {Object} {x, y} coordinates or {offsetX, offsetY} if returnOffset is true
   */
  getAnchorPoint(instance, anchor, returnOffset = false) {
    // Calculate based on anchor point
    let offsetX, offsetY;

    switch (anchor) {
      case "top-left":
        offsetX = 0;
        offsetY = 0;
        break;
      case "top":
      case "top-center":
        offsetX = this.getInstanceWidth(instance) / 2;
        offsetY = 0;
        break;
      case "top-right":
        offsetX = this.getInstanceWidth(instance);
        offsetY = 0;
        break;
      case "left":
      case "center-left":
        offsetX = 0;
        offsetY = this.getInstanceHeight(instance) / 2;
        break;
      case "center":
        offsetX = this.getInstanceWidth(instance) / 2;
        offsetY = this.getInstanceHeight(instance) / 2;
        break;
      case "right":
      case "center-right":
        offsetX = this.getInstanceWidth(instance);
        offsetY = this.getInstanceHeight(instance) / 2;
        break;
      case "bottom-left":
        offsetX = 0;
        offsetY = this.getInstanceHeight(instance);
        break;
      case "bottom":
      case "bottom-center":
        offsetX = this.getInstanceWidth(instance) / 2;
        offsetY = this.getInstanceHeight(instance);
        break;
      case "bottom-right":
        offsetX = this.getInstanceWidth(instance);
        offsetY = this.getInstanceHeight(instance);
        break;
      default:
        // Default to center
        offsetX = this.getInstanceWidth(instance) / 2;
        offsetY = this.getInstanceHeight(instance) / 2;
    }

    if (returnOffset) {
      return { offsetX, offsetY };
    } else {
      return {
        x: this.getInstanceX(instance) + offsetX,
        y: this.getInstanceY(instance) + offsetY,
      };
    }
  }

  /**
   * Get box model properties for an instance
   * @param {WorldInstance} instance - The instance to get box model for
   * @returns {Object} Box model properties
   */
  getBoxModel(instance) {
    const styles = this.getInstanceStyles(instance);

    // Get margin (supports individual sides or shorthand)
    const marginTop = styles.marginTop ?? styles.margin ?? 0;
    const marginRight = styles.marginRight ?? styles.margin ?? 0;
    const marginBottom = styles.marginBottom ?? styles.margin ?? 0;
    const marginLeft = styles.marginLeft ?? styles.margin ?? 0;

    // Get padding (supports individual sides or shorthand)
    const paddingTop = styles.paddingTop ?? styles.padding ?? 0;
    const paddingRight = styles.paddingRight ?? styles.padding ?? 0;
    const paddingBottom = styles.paddingBottom ?? styles.padding ?? 0;
    const paddingLeft = styles.paddingLeft ?? styles.padding ?? 0;

    // Get border (for now, just a single border size)
    const borderTop =
      styles.borderTopWidth ?? styles.borderWidth ?? styles.border ?? 0;
    const borderRight =
      styles.borderRightWidth ?? styles.borderWidth ?? styles.border ?? 0;
    const borderBottom =
      styles.borderBottomWidth ?? styles.borderWidth ?? styles.border ?? 0;
    const borderLeft =
      styles.borderLeftWidth ?? styles.borderWidth ?? styles.border ?? 0;

    return {
      margin: {
        top: marginTop,
        right: marginRight,
        bottom: marginBottom,
        left: marginLeft,
      },
      padding: {
        top: paddingTop,
        right: paddingRight,
        bottom: paddingBottom,
        left: paddingLeft,
      },
      border: {
        top: borderTop,
        right: borderRight,
        bottom: borderBottom,
        left: borderLeft,
      },
    };
  }

  /**
   * Get the total outer width of an instance including margin
   * @param {WorldInstance} instance - The instance
   * @returns {number} Total width including margin
   */
  getOuterWidth(instance) {
    const boxModel = this.getBoxModel(instance);
    return (
      this.getInstanceWidth(instance) +
      boxModel.margin.left +
      boxModel.margin.right
    );
  }

  /**
   * Get the total outer height of an instance including margin
   * @param {WorldInstance} instance - The instance
   * @returns {number} Total height including margin
   */
  getOuterHeight(instance) {
    const boxModel = this.getBoxModel(instance);
    return (
      this.getInstanceHeight(instance) +
      boxModel.margin.top +
      boxModel.margin.bottom
    );
  }

  /**
   * Get children that should be included in layout
   * @param {WorldInstance} instance - The parent instance
   * @returns {Array} Array of instances to layout
   */
  getLayoutChildren(instance) {
    return [...instance.children()]
      .filter((child) => {
        // Check if layout is explicitly disabled
        const doLayout = child.__flexbox_ui_element?.enabled;
        if (doLayout === false) return false;

        // Check visibility
        if (!child.isVisible) return false;

        // Check if child is positioned out of flow
        const childStyles = this.getInstanceStyles(child);
        const childPosition = childStyles.position || "relative";
        if (childPosition === "absolute" || childPosition === "anchor") {
          return false;
        }

        return true;
      })
      .sort((a, b) => (a._layoutOrder || 0) - (b._layoutOrder || 0));
  }

  /**
   * Layout children in a grid
   * @param {WorldInstance} container - The container
   * @param {Object} layoutProps - Layout properties
   * @param {Array} children - Array of child instances
   */
  layoutGrid(container, layoutProps, children) {
    // Get container box model
    const containerBoxModel = this.getBoxModel(container);

    // Extract layout parameters
    const columns = layoutProps.columns || 2;
    const gap = layoutProps.gap || 0;
    const justifyContent = layoutProps.justifyContent || "start";

    // Calculate available content width
    const contentWidth =
      this.getInstanceWidth(container) -
      containerBoxModel.padding.left -
      containerBoxModel.padding.right -
      containerBoxModel.border.left -
      containerBoxModel.border.right;

    // Calculate grid metrics
    const numRows = Math.ceil(children.length / columns);

    // Get maximum cell dimensions
    let maxCellWidth = 0;
    let maxCellHeight = 0;

    children.forEach((gridChild) => {
      const gridChildBoxModel = this.getBoxModel(gridChild);

      maxCellWidth = Math.max(
        maxCellWidth,
        this.getInstanceWidth(gridChild) +
          gridChildBoxModel.margin.left +
          gridChildBoxModel.margin.right
      );

      maxCellHeight = Math.max(
        maxCellHeight,
        this.getInstanceHeight(gridChild) +
          gridChildBoxModel.margin.top +
          gridChildBoxModel.margin.bottom
      );
    });

    // Calculate row and column metrics for justify-content
    // The width needed for all cells without any extra spacing
    const totalCellWidth = maxCellWidth * columns;

    // The total width of gaps between cells (not including any extra space)
    const totalGapWidth = (columns - 1) * gap;

    // The total width needed for cells and basic gaps
    const totalWidthNeeded = totalCellWidth + totalGapWidth;

    // Any extra space available
    const extraWidth = Math.max(0, contentWidth - totalWidthNeeded);

    // Calculate position adjustments based on justifyContent
    let startOffsetX = 0;
    let extraColumnGap = 0;

    switch (justifyContent) {
      case "start":
        startOffsetX = 0;
        break;

      case "center":
        startOffsetX = extraWidth / 2;
        break;

      case "end":
        startOffsetX = extraWidth;
        break;

      case "space-between":
        // Only add extra space between columns if there are multiple columns
        extraColumnGap = columns > 1 ? extraWidth / (columns - 1) : 0;
        break;

      case "space-around":
        // Add space around each column
        startOffsetX = extraWidth / columns / 2;
        extraColumnGap = extraWidth / columns;
        break;
    }

    // Now position each child
    children.forEach((child, index) => {
      const childStyles = this.getInstanceStyles(child);
      const childBoxModel = this.getBoxModel(child);

      // Calculate grid position
      const row = Math.floor(index / columns);
      const col = index % columns;

      // Calculate base position
      const baseX =
        containerBoxModel.padding.left +
        containerBoxModel.border.left +
        startOffsetX;
      const baseY =
        containerBoxModel.padding.top + containerBoxModel.border.top;

      // Handle alignSelf and justifySelf for individual grid items
      const alignSelf =
        childStyles.alignSelf || layoutProps.alignItems || "start";
      const justifySelf = childStyles.justifySelf || "start";

      // Calculate cell boundaries
      const cellLeft = baseX + col * (maxCellWidth + gap + extraColumnGap);
      const cellTop = baseY + row * (maxCellHeight + gap);
      const cellWidth = maxCellWidth;
      const cellHeight = maxCellHeight;

      // Calculate item position within cell based on self-alignment
      let itemX, itemY;

      // Horizontal positioning (justifySelf)
      switch (justifySelf) {
        case "center":
          itemX =
            cellLeft +
            (cellWidth -
              (this.getInstanceWidth(child) +
                childBoxModel.margin.left +
                childBoxModel.margin.right)) /
              2 +
            childBoxModel.margin.left;
          break;
        case "end":
          itemX =
            cellLeft +
            cellWidth -
            this.getInstanceWidth(child) -
            childBoxModel.margin.right;
          break;
        default: // 'start'
          itemX = cellLeft + childBoxModel.margin.left;
      }

      // Vertical positioning (alignSelf)
      switch (alignSelf) {
        case "center":
          itemY =
            cellTop +
            (cellHeight -
              (this.getInstanceHeight(child) +
                childBoxModel.margin.top +
                childBoxModel.margin.bottom)) /
              2 +
            childBoxModel.margin.top;
          break;
        case "end":
          itemY =
            cellTop +
            cellHeight -
            this.getInstanceHeight(child) -
            childBoxModel.margin.bottom;
          break;
        default: // 'start'
          itemY = cellTop + childBoxModel.margin.top;
      }

      // Apply final position
      this.setInstanceX(child, this.getInstanceX(container) + itemX);
      this.setInstanceY(child, this.getInstanceY(container) + itemY);
    });
  }

  /**
   * Apply styles to an instance
   * @param {WorldInstance} instance - The instance to apply styles to
   * @param {Object} styles - Style object to apply
   */
  applyStylesToInstance(instance, styles) {
    // Handle flex shorthand property directly
    if (styles.flex !== undefined && typeof styles.flex !== "object") {
      // Extract the numeric value or parse the shorthand if it's a string
      if (typeof styles.flex === "number") {
        styles.flexGrow = styles.flex;
        styles.flexShrink = 1;
        styles.flexBasis = "0px";
      }
      // Note: String values like "1 2 120" should be handled by parseFlexShorthand
    }

    // Build size constraints
    const constraints = {};
    if ("minWidth" in styles) constraints.minWidth = styles.minWidth;
    if ("maxWidth" in styles) constraints.maxWidth = styles.maxWidth;
    if ("minHeight" in styles) constraints.minHeight = styles.minHeight;
    if ("maxHeight" in styles) constraints.maxHeight = styles.maxHeight;

    // Handle percentage sizing if parent exists
    const parent = instance.getParent();
    if (parent) {
      const parentProps = this.getLayoutProperties(parent);
      if (
        "percentWidth" in styles ||
        ("width" in styles &&
          styles.width &&
          typeof styles.width === "string" &&
          styles.width.endsWith("%"))
      ) {
        let percentValue =
          "percentWidth" in styles
            ? styles.percentWidth
            : parseFloat(styles.width) || 0;

        if (parentProps.fitContent) {
          percentValue = 0;
        }

        if (percentValue >= 0) {
          const parent = instance.getParent();
          const parentBoxModel = this.getBoxModel(parent);
          const availableWidth =
            this.getInstanceWidth(parent) -
            parentBoxModel.padding.left -
            parentBoxModel.padding.right -
            parentBoxModel.border.left -
            parentBoxModel.border.right;

          this.setInstanceWidth(
            instance,
            (availableWidth * percentValue) / 100
          );
        }
      }

      if (
        "percentHeight" in styles ||
        ("height" in styles &&
          styles.height &&
          typeof styles.height === "string" &&
          styles.height.endsWith("%"))
      ) {
        let percentValue =
          "percentHeight" in styles
            ? styles.percentHeight
            : parseFloat(styles.height) || 0;

        if (parentProps.fitContent) {
          percentValue = 0;
        }

        if (percentValue >= 0) {
          const parent = instance.getParent();
          const parentBoxModel = this.getBoxModel(parent);
          const availableHeight =
            this.getInstanceHeight(parent) -
            parentBoxModel.padding.top -
            parentBoxModel.padding.bottom -
            parentBoxModel.border.top -
            parentBoxModel.border.bottom;

          this.setInstanceHeight(
            instance,
            (availableHeight * percentValue) / 100
          );
        }
      }
    }

    // Apply flex-basis for initial dimension (only if not percentage-based)
    const isHorizontal = styles.display === "horizontal";
    const isVertical = styles.display === "vertical" || !styles.display;

    if (parent && (isHorizontal || isVertical)) {
      const flexBasis = styles.flexBasis;

      if (flexBasis && flexBasis !== "auto" && typeof flexBasis === "number") {
        // Apply flex-basis along the main axis (width for row, height for column)
        if (isHorizontal) {
          this.setInstanceWidth(instance, flexBasis);
        } else if (isVertical) {
          this.setInstanceHeight(instance, flexBasis);
        }
      }
    }

    // Apply explicit width/height if specified as numeric values
    if ("width" in styles && typeof styles.width === "number") {
      this.setInstanceWidth(instance, styles.width);
    }

    if ("height" in styles && typeof styles.height === "number") {
      this.setInstanceHeight(instance, styles.height);
    }

    // Apply min/max constraints after explicit sizing
    if ("minWidth" in constraints) {
      this.setInstanceWidth(
        instance,
        Math.max(this.getInstanceWidth(instance), constraints.minWidth)
      );
    }

    if ("maxWidth" in constraints) {
      this.setInstanceWidth(
        instance,
        Math.min(this.getInstanceWidth(instance), constraints.maxWidth)
      );
    }

    if ("minHeight" in constraints) {
      this.setInstanceHeight(
        instance,
        Math.max(this.getInstanceHeight(instance), constraints.minHeight)
      );
    }

    if ("maxHeight" in constraints) {
      this.setInstanceHeight(
        instance,
        Math.min(this.getInstanceHeight(instance), constraints.maxHeight)
      );
    }
  }

  /**
   * Layout children in a vertical stack with flex distribution
   * @param {WorldInstance} container - The container
   * @param {Object} layoutProps - Layout properties
   * @param {Array} children - Array of child instances
   */
  layoutVertical(container, layoutProps, children) {
    // Get container box model
    const containerBoxModel = this.getBoxModel(container);

    // Extract layout parameters
    const gap = layoutProps.gap || 0;
    const alignment = layoutProps.alignItems || "start";

    // Calculate available space
    const contentHeight =
      this.getInstanceHeight(container) -
      containerBoxModel.padding.top -
      containerBoxModel.padding.bottom -
      containerBoxModel.border.top -
      containerBoxModel.border.bottom;

    const contentWidth =
      this.getInstanceWidth(container) -
      containerBoxModel.padding.left -
      containerBoxModel.padding.right -
      containerBoxModel.border.left -
      containerBoxModel.border.right;

    // First pass: collect fixed height items and flex items
    const fixedItems = [];
    const flexItems = [];
    let totalFixedHeight = 0;
    let totalFlexGrow = 0;
    let totalFlexShrinkFactors = 0;

    children.forEach((child) => {
      const childStyles = this.getInstanceStyles(child);
      const childBoxModel = this.getBoxModel(child);

      // Determine if this is a flex item based on flex-grow or flex-shrink
      const flexGrow = parseFloat(childStyles.flexGrow) || 0;
      const flexShrink = parseFloat(childStyles.flexShrink);
      const actualFlexShrink =
        typeof flexShrink === "undefined" ? 1 : flexShrink;

      // Determine the base height (flex-basis)
      let baseHeight = this.getInstanceHeight(child); // Default to current height

      // Check if flex-basis is set and apply it first
      if (
        childStyles.flexBasis !== undefined &&
        childStyles.flexBasis !== "auto"
      ) {
        if (typeof childStyles.flexBasis === "number") {
          baseHeight = childStyles.flexBasis;
        } else if (
          typeof childStyles.flexBasis === "string" &&
          !childStyles.flexBasis.endsWith("%")
        ) {
          // Handle other units if supported
          baseHeight = parseFloat(childStyles.flexBasis) || baseHeight;
        }
        // Percentage flex-basis is handled earlier in applyPercentageSizing
      }

      if (flexGrow > 0 || actualFlexShrink > 0) {
        // This is a flex item
        flexItems.push({
          instance: child,
          boxModel: childBoxModel,
          flexGrow,
          flexShrink: actualFlexShrink,
          baseHeight: baseHeight, // Store the flex-basis or initial height
          initialHeight: this.getInstanceHeight(child), // Store current height for reference
          minHeight: childStyles.minHeight,
          maxHeight: childStyles.maxHeight,
        });

        totalFlexGrow += flexGrow;
        totalFlexShrinkFactors += actualFlexShrink * baseHeight;
      } else {
        // This is a fixed item
        fixedItems.push(child);
        totalFixedHeight +=
          this.getInstanceHeight(child) +
          childBoxModel.margin.top +
          childBoxModel.margin.bottom;
      }
    });

    // Calculate total gaps
    const totalGaps = children.length > 1 ? (children.length - 1) * gap : 0;

    // Calculate the space available for flex distribution
    let availableSpace = contentHeight - totalFixedHeight - totalGaps;

    // Ensure we don't try to distribute more space than is actually available
    const totalAvailableHeight = contentHeight - totalGaps;

    // Initialize flex items with their base heights
    let initialFlexHeight = 0;
    flexItems.forEach((item) => {
      item.targetHeight = item.baseHeight;
      initialFlexHeight +=
        item.baseHeight +
        item.boxModel.margin.top +
        item.boxModel.margin.bottom;
    });

    // Adjust available space if needed
    if (initialFlexHeight + totalFixedHeight > totalAvailableHeight) {
      // Need to shrink items
      availableSpace =
        totalAvailableHeight - totalFixedHeight - initialFlexHeight;
    } else {
      // Only grow up to the container height
      availableSpace = Math.min(
        availableSpace,
        totalAvailableHeight - totalFixedHeight - initialFlexHeight
      );
    }

    // Keep track of remaining flex grow
    let remainingFlexGrow = totalFlexGrow;
    let remainingSpace = availableSpace;
    let stillFlexing = true;

    // Track constrained items to skip in subsequent passes
    const constrainedItems = new Set();

    // Apply flex-grow through multiple passes if needed (handling min/max constraints)
    if (availableSpace > 0 && totalFlexGrow > 0) {
      // Distribute space in multiple passes if needed
      while (remainingSpace > 0.1 && remainingFlexGrow > 0 && stillFlexing) {
        let spaceConsumedThisPass = 0;
        stillFlexing = false;

        // Distribute remaining space based on remaining flex-grow factors
        flexItems.forEach((item) => {
          if (constrainedItems.has(item)) return;

          if (item.flexGrow > 0) {
            const extraSpace =
              (item.flexGrow / remainingFlexGrow) * remainingSpace;
            const newTargetHeight = item.targetHeight + extraSpace;

            // Check constraints
            let constrainedHeight = newTargetHeight;
            let wasConstrained = false;

            if (
              item.minHeight !== undefined &&
              constrainedHeight < item.minHeight
            ) {
              constrainedHeight = item.minHeight;
              wasConstrained = true;
            }

            if (
              item.maxHeight !== undefined &&
              constrainedHeight > item.maxHeight
            ) {
              constrainedHeight = item.maxHeight;
              wasConstrained = true;
            }

            // Calculate how much space was actually consumed
            const actualExtraSpace = constrainedHeight - item.targetHeight;
            spaceConsumedThisPass += actualExtraSpace;

            // Update target height
            item.targetHeight = constrainedHeight;

            // If constrained, mark this item to skip in future passes
            if (wasConstrained) {
              constrainedItems.add(item);
              remainingFlexGrow -= item.flexGrow;
            } else {
              stillFlexing = true;
            }
          }
        });

        // Update remaining space for next pass
        remainingSpace -= spaceConsumedThisPass;

        // Safety check to prevent infinite loops
        if (spaceConsumedThisPass < 0.01) break;
      }
    } else if (availableSpace < 0 && totalFlexShrinkFactors > 0) {
      // Shrink case - reduce sizes proportionally
      flexItems.forEach((item) => {
        if (item.flexShrink > 0) {
          const shrinkRatio =
            (item.flexShrink * item.baseHeight) / totalFlexShrinkFactors;
          const reduction = Math.abs(availableSpace) * shrinkRatio;
          item.targetHeight = Math.max(0, item.baseHeight - reduction);

          // Apply min constraint (max is not needed here as we're making items smaller)
          if (
            item.minHeight !== undefined &&
            item.targetHeight < item.minHeight
          ) {
            item.targetHeight = item.minHeight;
          }
        } else {
          item.targetHeight = item.baseHeight;
        }
      });
    }

    // Apply final sizes to flex items
    flexItems.forEach((item) => {
      this.setInstanceHeight(item.instance, item.targetHeight);
    });

    // Calculate spacing based on justifyContent
    const justifyContent = layoutProps.justifyContent || "start";

    // Recalculate actual total height after flex adjustments
    let actualTotalHeight = 0;
    children.forEach((child) => {
      const childBoxModel = this.getBoxModel(child);
      actualTotalHeight +=
        this.getInstanceHeight(child) +
        childBoxModel.margin.top +
        childBoxModel.margin.bottom;
    });
    actualTotalHeight += totalGaps;

    // Calculate spacing based on justifyContent
    let startOffset = 0;
    let spaceBetween = 0;
    let spaceAround = 0;

    const justifyRemainingSpace = Math.max(
      0,
      contentHeight - actualTotalHeight
    );

    switch (justifyContent) {
      case "start":
        startOffset = 0;
        break;
      case "center":
        startOffset = justifyRemainingSpace / 2;
        break;
      case "end":
        startOffset = justifyRemainingSpace;
        break;
      case "space-between":
        spaceBetween =
          children.length > 1
            ? justifyRemainingSpace / (children.length - 1)
            : 0;
        break;
      case "space-around":
        spaceAround =
          children.length > 0 ? justifyRemainingSpace / children.length : 0;
        break;
    }

    // Position children with justifyContent and alignItems
    let currentY =
      containerBoxModel.padding.top +
      containerBoxModel.border.top +
      startOffset;

    if (justifyContent === "space-around" && children.length > 0) {
      currentY += spaceAround / 2;
    }

    children.forEach((child, index) => {
      const childStyles = this.getInstanceStyles(child);
      const childBoxModel = this.getBoxModel(child);

      // Account for child's margin
      currentY += childBoxModel.margin.top;

      // Position vertically
      this.setInstanceY(child, this.getInstanceY(container) + currentY);

      // Handle horizontal alignment (cross-axis)
      // Check for alignSelf which overrides the container's alignItems
      const alignSelf = childStyles.alignSelf || alignment;

      switch (alignSelf) {
        case "center":
          this.setInstanceX(
            child,
            this.getInstanceX(container) +
              containerBoxModel.padding.left +
              containerBoxModel.border.left +
              (contentWidth -
                (this.getInstanceWidth(child) +
                  childBoxModel.margin.left +
                  childBoxModel.margin.right)) /
                2 +
              childBoxModel.margin.left
          );
          break;
        case "end":
          this.setInstanceX(
            child,
            this.getInstanceX(container) +
              this.getInstanceWidth(container) -
              containerBoxModel.padding.right -
              containerBoxModel.border.right -
              this.getInstanceWidth(child) -
              childBoxModel.margin.right
          );
          break;
        default: // 'start'
          this.setInstanceX(
            child,
            this.getInstanceX(container) +
              containerBoxModel.padding.left +
              containerBoxModel.border.left +
              childBoxModel.margin.left
          );
      }

      // Move to next vertical position
      currentY += this.getInstanceHeight(child) + childBoxModel.margin.bottom;

      // Add gap and spacing for next element
      if (index < children.length - 1) {
        currentY += gap + spaceBetween;
        if (justifyContent === "space-around") {
          currentY += spaceAround;
        }
      }
    });
  }

  /**
   * Layout children in a horizontal row with flex distribution
   * @param {WorldInstance} container - The container
   * @param {Object} layoutProps - Layout properties
   * @param {Array} children - Array of child instances
   */
  layoutHorizontal(container, layoutProps, children) {
    // Get container box model
    const containerBoxModel = this.getBoxModel(container);

    // Extract layout parameters
    const gap = layoutProps.gap || 0;
    const alignment = layoutProps.alignItems || "start";

    // Calculate available space
    const contentWidth =
      this.getInstanceWidth(container) -
      containerBoxModel.padding.left -
      containerBoxModel.padding.right -
      containerBoxModel.border.left -
      containerBoxModel.border.right;

    const contentHeight =
      this.getInstanceHeight(container) -
      containerBoxModel.padding.top -
      containerBoxModel.padding.bottom -
      containerBoxModel.border.top -
      containerBoxModel.border.bottom;

    // First pass: collect fixed width items and flex items
    const fixedItems = [];
    const flexItems = [];
    let totalFixedWidth = 0;
    let totalFlexGrow = 0;
    let totalFlexShrinkFactors = 0;

    children.forEach((child) => {
      const childStyles = this.getInstanceStyles(child);
      const childBoxModel = this.getBoxModel(child);

      // Determine if this is a flex item based on flex-grow or flex-shrink
      const flexGrow = parseFloat(childStyles.flexGrow) || 0;
      const flexShrink = parseFloat(childStyles.flexShrink);
      const actualFlexShrink =
        typeof flexShrink === "undefined" ? 1 : flexShrink;

      // Determine the base width (flex-basis)
      let baseWidth = this.getInstanceWidth(child); // Default to current width

      // Check if flex-basis is set and apply it first
      if (
        childStyles.flexBasis !== undefined &&
        childStyles.flexBasis !== "auto"
      ) {
        if (typeof childStyles.flexBasis === "number") {
          baseWidth = childStyles.flexBasis;
        } else if (
          typeof childStyles.flexBasis === "string" &&
          !childStyles.flexBasis.endsWith("%")
        ) {
          // Handle other units if supported
          baseWidth = parseFloat(childStyles.flexBasis) || baseWidth;
        }
        // Percentage flex-basis is handled earlier in applyPercentageSizing
      }

      if (flexGrow > 0 || actualFlexShrink > 0) {
        // This is a flex item
        flexItems.push({
          instance: child,
          boxModel: childBoxModel,
          flexGrow,
          flexShrink: actualFlexShrink,
          baseWidth: baseWidth, // Store the flex-basis or initial width
          initialWidth: this.getInstanceWidth(child), // Store current width for reference
          minWidth: childStyles.minWidth,
          maxWidth: childStyles.maxWidth,
        });

        totalFlexGrow += flexGrow;
        totalFlexShrinkFactors += actualFlexShrink * baseWidth;
      } else {
        // This is a fixed item
        fixedItems.push(child);
        totalFixedWidth +=
          this.getInstanceWidth(child) +
          childBoxModel.margin.left +
          childBoxModel.margin.right;
      }
    });

    // Calculate total gaps
    const totalGaps = children.length > 1 ? (children.length - 1) * gap : 0;

    // Ensure we don't try to distribute more space than is actually available
    const totalAvailableWidth = contentWidth - totalGaps;

    // Initialize flex items with their base widths
    let initialFlexWidth = 0;
    flexItems.forEach((item) => {
      item.targetWidth = item.baseWidth;
      initialFlexWidth +=
        item.baseWidth + item.boxModel.margin.left + item.boxModel.margin.right;
    });

    // Calculate the space available for flex distribution
    let availableSpace =
      contentWidth - totalFixedWidth - initialFlexWidth - totalGaps;

    // Adjust available space if needed
    if (initialFlexWidth + totalFixedWidth > totalAvailableWidth) {
      // Need to shrink items
      availableSpace = totalAvailableWidth - totalFixedWidth - initialFlexWidth;
    } else {
      // Only grow up to the container width
      availableSpace = Math.min(
        availableSpace,
        totalAvailableWidth - totalFixedWidth - initialFlexWidth
      );
    }

    // Keep track of remaining flex grow
    let remainingFlexGrow = totalFlexGrow;
    let remainingSpace = availableSpace;
    let stillFlexing = true;

    // Track constrained items to skip in subsequent passes
    const constrainedItems = new Set();

    // Apply flex-grow through multiple passes if needed (handling min/max constraints)
    if (availableSpace > 0 && totalFlexGrow > 0) {
      // Distribute space in multiple passes if needed
      while (remainingSpace > 0.1 && remainingFlexGrow > 0 && stillFlexing) {
        let spaceConsumedThisPass = 0;
        stillFlexing = false;

        // Distribute remaining space based on remaining flex-grow factors
        flexItems.forEach((item) => {
          if (constrainedItems.has(item)) return;

          if (item.flexGrow > 0) {
            const extraSpace =
              (item.flexGrow / remainingFlexGrow) * remainingSpace;
            const newTargetWidth = item.targetWidth + extraSpace;

            // Check constraints
            let constrainedWidth = newTargetWidth;
            let wasConstrained = false;

            if (
              item.minWidth !== undefined &&
              constrainedWidth < item.minWidth
            ) {
              constrainedWidth = item.minWidth;
              wasConstrained = true;
            }

            if (
              item.maxWidth !== undefined &&
              constrainedWidth > item.maxWidth
            ) {
              constrainedWidth = item.maxWidth;
              wasConstrained = true;
            }

            // Calculate how much space was actually consumed
            const actualExtraSpace = constrainedWidth - item.targetWidth;
            spaceConsumedThisPass += actualExtraSpace;

            // Update target width
            item.targetWidth = constrainedWidth;

            // If constrained, mark this item to skip in future passes
            if (wasConstrained) {
              constrainedItems.add(item);
              remainingFlexGrow -= item.flexGrow;
            } else {
              stillFlexing = true;
            }
          }
        });

        // Update remaining space for next pass
        remainingSpace -= spaceConsumedThisPass;

        // Safety check to prevent infinite loops
        if (spaceConsumedThisPass < 0.01) break;
      }
    } else if (availableSpace < 0 && totalFlexShrinkFactors > 0) {
      // Shrink case - reduce sizes proportionally
      flexItems.forEach((item) => {
        if (item.flexShrink > 0) {
          const shrinkRatio =
            (item.flexShrink * item.baseWidth) / totalFlexShrinkFactors;
          const reduction = Math.abs(availableSpace) * shrinkRatio;
          item.targetWidth = Math.max(0, item.baseWidth - reduction);

          // Apply min constraint (max is not needed here as we're making items smaller)
          if (item.minWidth !== undefined && item.targetWidth < item.minWidth) {
            item.targetWidth = item.minWidth;
          }
        } else {
          item.targetWidth = item.baseWidth;
        }
      });
    }

    // Apply final sizes to flex items
    flexItems.forEach((item) => {
      this.setInstanceWidth(item.instance, item.targetWidth);
    });

    // Calculate spacing based on justifyContent
    const justifyContent = layoutProps.justifyContent || "start";

    // Recalculate actual total width after flex adjustments
    let actualTotalWidth = 0;
    children.forEach((child) => {
      const childBoxModel = this.getBoxModel(child);
      actualTotalWidth +=
        this.getInstanceWidth(child) +
        childBoxModel.margin.left +
        childBoxModel.margin.right;
    });
    actualTotalWidth += totalGaps;

    // Calculate spacing based on justifyContent
    let startOffset = 0;
    let spaceBetween = 0;
    let spaceAround = 0;

    const justifyRemainingSpace = Math.max(0, contentWidth - actualTotalWidth);

    switch (justifyContent) {
      case "start":
        startOffset = 0;
        break;
      case "center":
        startOffset = justifyRemainingSpace / 2;
        break;
      case "end":
        startOffset = justifyRemainingSpace;
        break;
      case "space-between":
        spaceBetween =
          children.length > 1
            ? justifyRemainingSpace / (children.length - 1)
            : 0;
        break;
      case "space-around":
        spaceAround =
          children.length > 0 ? justifyRemainingSpace / children.length : 0;
        break;
    }

    // Position children with justifyContent and alignItems
    let currentX =
      containerBoxModel.padding.left +
      containerBoxModel.border.left +
      startOffset;

    if (justifyContent === "space-around" && children.length > 0) {
      currentX += spaceAround / 2;
    }

    children.forEach((child, index) => {
      const childStyles = this.getInstanceStyles(child);
      const childBoxModel = this.getBoxModel(child);

      // Account for child's margin
      currentX += childBoxModel.margin.left;

      // Position horizontally
      this.setInstanceX(child, this.getInstanceX(container) + currentX);

      // Handle vertical alignment (cross-axis)
      // Check for alignSelf which overrides the container's alignItems
      const alignSelf = childStyles.alignSelf || alignment;

      switch (alignSelf) {
        case "center":
          this.setInstanceY(
            child,
            this.getInstanceY(container) +
              containerBoxModel.padding.top +
              containerBoxModel.border.top +
              (contentHeight -
                (this.getInstanceHeight(child) +
                  childBoxModel.margin.top +
                  childBoxModel.margin.bottom)) /
                2 +
              childBoxModel.margin.top
          );
          break;
        case "end":
          this.setInstanceY(
            child,
            this.getInstanceY(container) +
              this.getInstanceHeight(container) -
              containerBoxModel.padding.bottom -
              containerBoxModel.border.bottom -
              this.getInstanceHeight(child) -
              childBoxModel.margin.bottom
          );
          break;
        default: // 'start'
          this.setInstanceY(
            child,
            this.getInstanceY(container) +
              containerBoxModel.padding.top +
              containerBoxModel.border.top +
              childBoxModel.margin.top
          );
      }

      // Move to next horizontal position
      currentX += this.getInstanceWidth(child) + childBoxModel.margin.right;

      // Add gap and spacing for next element
      if (index < children.length - 1) {
        currentX += gap + spaceBetween;
        if (justifyContent === "space-around") {
          currentX += spaceAround;
        }
      }
    });
  }
}

export default UILayout;
