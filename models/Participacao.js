const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Participacao = sequelize.define(
  "Participacao",
  {
    participacaoId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    convidadoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Convidado", key: "convidadoId" },
    },
    ingressoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Ingresso", key: "ingressoId" },
    },
    statusPagamento: {
      type: DataTypes.ENUM('Pendente', 'Confirmado', 'Cancelado', 'Reembolsado'),
      allowNull: false,
      defaultValue: 'Pendente',
    },
    codigoTransacao: {
        type: DataTypes.STRING(100),
        allowNull: true,
    }
  },
  {
    tableName: "Participacao",
    timestamps: true,
  }
);

sequelize.sync();
module.exports = Participacao;
