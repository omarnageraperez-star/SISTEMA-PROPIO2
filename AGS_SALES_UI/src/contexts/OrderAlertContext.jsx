import React, { createContext, useContext, useState } from "react";
import { playNewOrderSound } from "../lib/sound";
// Removed react-bootstrap Toast import; using custom toast

const OrderAlertContext = createContext();
export const useOrderAlert = () => useContext(OrderAlertContext);

export const OrderAlertProvider = ({ children }) => {
  const [show, setShow] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);

  const triggerAlert = (order) => {
    setOrderInfo(order);
    setShow(true);
    playNewOrderSound();
  };

  const handleClose = () => setShow(false);

  return (
    <OrderAlertContext.Provider value={{ triggerAlert }}>
      {children}
{show && (
  <div
    onClick={handleClose}
    style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 9999,
      minWidth: 250,
      background: "rgba(15,71,175,0.85)",
      color: "white",
      padding: "12px 16px",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      backdropFilter: "blur(8px)",
      cursor: "pointer",
      fontFamily: "Inter, sans-serif"
    }}
  >
    <strong style={{ color: "#e5a93b" }}>Nuevo pedido de catálogo</strong>
    <div>{orderInfo?.client_name || "Nuevo pedido recibido"}</div>
  </div>
)}
    </OrderAlertContext.Provider>
  );
};
