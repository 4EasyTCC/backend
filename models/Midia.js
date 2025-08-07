const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Evento = require("./Evento");
const Midia = sequelize.define(
  "Midia",
  {
    midiaId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    eventoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Evento",
        key: "eventoId",
      },
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "galeria",
    },
  },
  {
    tableName: "Midia",
    timestamps: true,
  }
);

Midia.belongsTo(Evento, {
  foreignKey: {
    name: "eventoId",
  },
});

Evento.hasMany(Midia, {
  foreignKey: "eventoId",
});

module.exports = Midia;
