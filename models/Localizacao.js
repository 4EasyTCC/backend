const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Localizacao = sequelize.define(
  "Localizacao",
  {
    localizacaoId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    endereco: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    cidade: {
      type: DataTypes.STRING(300),
    },
    estado: {
      type: DataTypes.STRING(300),
    },
    cep: {
      type: DataTypes.STRING(300),
    },
    complemento: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
  },
  {
    tableName: "Localizacao",
    timestamps: true,
  }
);

module.exports = Localizacao;
