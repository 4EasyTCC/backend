// models/MembrosGrupo.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const MembrosGrupo = sequelize.define(
  "MembrosGrupo",
  {
    membroId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    grupoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Grupo", key: "grupoId" },
    },
    convidadoId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Permitir nulo caso decida adicionar Organizadores
      references: { model: "Convidado", key: "convidadoId" },
    },
  },
  {
    tableName: "MembrosGrupo",
    timestamps: true,
  }
);

module.exports = MembrosGrupo;

const Grupo = require("./Grupo");
const Convidado = require("./Convidado");

Grupo.belongsToMany(Convidado, { through: MembrosGrupo, foreignKey: 'grupoId', as: 'membrosConvidado' });
Convidado.belongsToMany(Grupo, { through: MembrosGrupo, foreignKey: 'convidadoId', as: 'grupos' });

MembrosGrupo.belongsTo(Grupo, { foreignKey: 'grupoId', as: 'grupo' });
MembrosGrupo.belongsTo(Convidado, { foreignKey: 'convidadoId', as: 'convidado' });