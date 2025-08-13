const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Grupo = sequelize.define(
  "Grupo",
  {
    grupoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "Grupo",
    timestamps: true,
  }
);

module.exports = Grupo;
