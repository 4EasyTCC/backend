const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Evento = require("./Evento");

const Ingresso = sequelize.define(
  "Ingresso",
  {
    ingressoId: {
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
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.STRING(255),
    },
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dataLimite: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    qrCode: {
      type: DataTypes.TEXT,
    },
  },

  {
    tableName: "Ingresso",
    timestamps: true,
  }
);

Ingresso.belongsTo(Evento, {
  foreignKey: {
    name: "eventoId",
  },
});

Evento.hasMany(Ingresso, {
  foreignKey: "eventoId",
});

module.exports = Ingresso;
