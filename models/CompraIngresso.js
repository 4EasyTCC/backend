const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const CompraIngresso = sequelize.define(
  "CompraIngresso",
  {
    compraId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    // FK para a tabela de Convidado (quem comprou)
    convidadoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // FK para a tabela de Ingresso (qual ingresso foi comprado)
    ingressoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    valorTotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    statusPagamento: {
      type: DataTypes.ENUM("pendente", "confirmado", "cancelado"),
      allowNull: false,
      defaultValue: "pendente",
    },
  },
  {
    tableName: "compras_ingressos",
    timestamps: true,
  }
);

module.exports = CompraIngresso;

const Convidado = require("./Convidado");
const Ingresso = require("./Ingresso");

CompraIngresso.belongsTo(Convidado, { 
    foreignKey: "convidadoId", 
    as: "comprador" 
});

CompraIngresso.belongsTo(Ingresso, { 
    foreignKey: "ingressoId", 
    as: "ingressoComprado" 
});
