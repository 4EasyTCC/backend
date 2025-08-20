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

    eventoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Evento",
        key: "eventoId",
      },
    },
    organizadorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Organizador",
        key: "organizadorId",
      },
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

const Organizador = require("./Organizador");
const Evento = require("./Evento");

Grupo.belongsTo(Evento, {
  foreignKey: "eventoId",
  as: "evento",
});

Grupo.belongsTo(Organizador, {
  foreignKey: "organizadorId",
  as: "organizador",
});
