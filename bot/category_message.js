const categories = require("../models/categories");

module.exports = async function (category) {
  let message = `${category.title} - ${
    category.type === "main" ? "основная" : "вложенная"
  }\n${category.description}\nid: ${category._id.toString("hex")}`;
  if (category.type !== "main") {
    const parent = await categories.findById(category.parent, "title");
    if (parent) message += `\n\nВложена в "${parent.title}"`;
    else message += "\n\nКатегорию необходимо вложить в основную";
  }

  if (category.hidden) message += "\nКатегория скрыта";

  return message;
};
