import { action, condition, expression } from "../template/aceDefine.js";

const category = "general";

action(
  category,
  "SetClassStyle",
  {
    highlight: true,
    deprecated: false,
    isAsync: false,
    listName: "Declare Class",
    displayText: "Declare class [b]{0}[/b] to [i]{1}[/i]",
    description: "Sets the style for a class",
    params: [
      {
        id: "className",
        name: "Class Name",
        desc: "The name of the class to set the style for",
        type: "string",
        initialValue: "",
      },
      {
        id: "styleString",
        name: "Style String",
        desc: "The CSS style string to apply to the class",
        type: "string",
        initialValue: "",
      },
    ],
  },
  function (className, styleString) {
    this.setClassStyle(className, styleString);
  },
  false
);

action(
  category,
  "SetClassProperty",
  {
    highlight: false,
    deprecated: false,
    isAsync: false,
    listName: "Set Class Property",
    displayText: "Set property [b]{1}[/b] to [b]{2}[/b] in class [b]{0}[/b]",
    description: "Sets a property for a class",
    params: [
      {
        id: "className",
        name: "Class Name",
        desc: "The name of the class to set the property for",
        type: "string",
        initialValue: "",
      },
      {
        id: "property",
        name: "Property",
        desc: "The CSS property to set",
        type: "string",
        initialValue: "",
      },
      {
        id: "value",
        name: "Value",
        desc: "The value to set for the property",
        type: "string",
        initialValue: "",
      },
    ],
  },
  function (className, property, value) {
    this.setClassProperty(className, property, value);
  },
  false
);

action(
  category,
  "RemoveClassProperty",
  {
    highlight: false,
    deprecated: false,
    isAsync: false,
    listName: "Remove Class Property",
    displayText: "Remove property [b]{1}[/b] from class [b]{0}[/b]",
    description: "Removes a property from a class",
    params: [
      {
        id: "className",
        name: "Class Name",
        desc: "The name of the class to remove the property from",
        type: "string",
        initialValue: "",
      },
      {
        id: "property",
        name: "Property",
        desc: "The CSS property to remove",
        type: "string",
        initialValue: "",
      },
    ],
  },
  function (className, property) {
    this.removeClassProperty(className, property);
  },
  false
);
