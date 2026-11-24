import { useEffect, useState } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

const OrderStatusUpdates = () => {
    const [orderUpdates, setOrderUpdates] = useState([]);

    useEffect(() => {
        const socket = new SockJS("http://localhost:8080/ws");
        const stompClient = Stomp.over(socket);

        stompClient.connect({}, () => {
            stompClient.subscribe("/topic/order-updates", (message) => {
                const updatedOrder = JSON.parse(message.body);
                setOrderUpdates((prevUpdates) => [...prevUpdates, updatedOrder]);
            });
        });

        return () => stompClient.disconnect();
    }, []);

    return (
        <div>
            <h3>Live Order Updates</h3>
            {orderUpdates.map((order, index) => (
                <p key={index}>
                    Order {order.id} is now {order.status}
                </p>
            ))}
        </div>
    );
};

export default OrderStatusUpdates;
