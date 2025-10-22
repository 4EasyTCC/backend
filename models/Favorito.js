const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Favorito = sequelize.define('Favorito', {
  favoritoId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  convidadoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  eventoId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  organizadorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'Favoritos',
  indexes: [
    {
      unique: true,
      fields: ['convidadoId', 'eventoId'],
    },
    {
      unique: true,
      fields: ['convidadoId', 'organizadorId'],
    },
  ],
});

module.exports = Favorito;
