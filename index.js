const { Connection, Request } = require("tedious");
const express = require("express");
const cors = require("cors");
const port = 443;

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create connection to database
const config = {
    authentication: {
        options: {
            userName: "pennyjuiceadmin",
            password: "123qwe$%^RTY",
        },
        type: "default",
    },
    server: "pennyjuicesql.database.windows.net",
    options: {
        database: "mySampleDatabase",
        encrypt: true,
    },
};

const connection = new Connection(config);
// Attempt to connect and execute queries if connection goes through
connection.on("connect", (err) => {
    if (err) {
        console.error(err.message);
    } else {
        // Listen for requests
        app.listen(port, () => {
            console.log("Listening at http://localhost:" + port);
        });
    }
});
connection.connect();

app.post("/signup", (req, res) => {
    const request = new Request(
        `INSERT INTO dbo.Customer (email, pass, username)
    VALUES ('${req.body.email}','${req.body.password}','${req.body.username}')`,
        (err) => {
            if (err) console.error(err.message);
        }
    );
    request.on("requestCompleted", () => {
        res.send("ok");
    });

    connection.execSql(request);
});

app.post("/login", (req, res) => {
    const request = new Request(
        `SELECT customerId, username FROM dbo.Customer 
        WHERE email = '${req.body.email}'
        AND pass = '${req.body.password}'`,
        (err, rowCount) => {
            if (err) {
                res.status(500).send(err.message);
            } else if (rowCount === 0) {
                res.status(401).send("Invalid login credentials.");
            }
        }
    );

    request.on("row", (columns) => {
        let user = [
            ...columns.map((column) => {
                return column.value;
            }),
        ];
        res.send(user);
    });

    connection.execSql(request);
});

app.get("/product", (req, res) => {
    let products = [];
    // Read all rows from table
    const request = new Request(
        `SELECT * FROM dbo.Product`,
        (err, rowCount) => {
            if (err) console.error(err.message);
            else if (rowCount === 0) {
                res.send([]);
                return;
            }
        }
    );
    request.on("row", (columns) => {
        products.push({
            id: columns[0].value,
            name: columns[1].value,
            description: columns[2].value,
            category: columns[3].value,
            price: columns[4].value,
        });
    });
    request.on("requestCompleted", () => {
        res.send(products);
    });
    connection.execSql(request);
});

app.post("/product", (req, res) => {
    // Read all rows from table
    const request = new Request(
        `INSERT INTO dbo.Product 
    (productName, descrip, category, price)
    VALUES ('${req.body.name}','${req.body.description}','${req.body.category}','${req.body.price}')`,
        (err) => {
            if (err) console.error(err.message);
        }
    );
    request.on("requestCompleted", () => {
        res.send("ok");
    });
    connection.execSql(request);
});

app.get("/order", (req, res) => {
    // const getOrderItem = (orderList) => {
    //     let itemList = [];
    //     orderList.forEach((order, i) => {
    //         let items = [];
    //         const request = new Request(
    //             `SELECT * FROM dbo.OrderItem
    //             WHERE orderId = '${order.id}'`,
    //             (err) => {
    //                 if (err) console.error(err.message);
    //             }
    //         );

    //         request.on("row", (columns) => {
    //             items.push({
    //                 id: columns[0].value,
    //                 name: columns[1].value,
    //                 qty: columns[2].value,
    //                 price: columns[3].value,
    //                 orderId: columns[4].value,
    //             });
    //         });

    //         request.on("requestCompleted", () => {
    //             itemList.push(items);
    //         });

    //         connection.execSql(request);
    //     });
    // };

    const getOrderList = () => {
        let orderList = [];
        const request = new Request(
            `SELECT * FROM dbo.OrderCase 
    WHERE customerId = '${req.query.uid}'`,
            (err, rowCount) => {
                if (err) console.error(err.message);
            }
        );
        request.on("row", (columns) => {
            orderList.push({
                id: columns[0].value,
                amount: columns[1].value,
                orderDate: columns[2].value,
                deliveryAddress: columns[3].value,
                customerId: columns[4].value,
            });
        });
        request.on("requestCompleted", () => {
            res.send(orderList);
        });

        connection.execSql(request);
    };

    getOrderList();
});

app.get("/order/:orderid", (req, res) => {
    let orderItems = [];
    const request = new Request(
        `SELECT productId, productName, qty, price FROM dbo.OrderItem 
        WHERE orderId = '${req.params.orderid}'`,
        (err, rowCount) => {
            if (err) {
                res.status(500).send(err.message);
            }
        }
    );

    request.on("requestCompleted", () => {
        let orderList = [];
        const request = new Request(
            `SELECT orderDate FROM dbo.OrderCase 
        WHERE orderId = '${req.params.orderid}'`,
            (err, rowCount) => {
                if (err) console.error(err.message);
            }
        );

        request.on("row", (columns) => {
            res.send({ date: columns[0].value, items: orderItems });
        });

        request.on("requestCompleted", () => {
            return;
        });

        connection.execSql(request);
    });

    request.on("row", (columns) => {
        orderItems.push({
            id: columns[0].value,
            name: columns[1].value,
            qty: columns[2].value,
            price: columns[3].value,
        });
    });

    connection.execSql(request);
});

app.post("/order", (req, res) => {
    const addOrderItem = (orderId) => {
        const request = new Request(
            `INSERT INTO dbo.OrderItem (productId, productName, qty, price, orderId)
                VALUES ${req.body.items.map(
                    (i) =>
                        `(${i.id},'${i.name}',${i.qty},${i.price},${orderId})`
                )}`,
            (err) => console.error(err)
        );

        connection.execSql(request);
    };

    let orderId;
    const addOrder = () => {
        const request = new Request(
            `INSERT INTO dbo.OrderCase (amount, orderDate, deliveryAddress, customerId)
            VALUES (${req.body.amount},'${req.body.orderDate}','${req.body.deliveryAddress}',${req.body.customerId});
            SELECT @@identity`,
            (err) => {
                if (err) console.error(err.message);
            }
        );

        request.on("requestCompleted", () => {
            addOrderItem(orderId);
        });

        request.on("row", (columns) => {
            orderId = columns[0].value;
        });

        connection.execSql(request);
    };

    addOrder();
});

app.delete("/order", (req, res) => {
    const request = new Request(
        `DELETE FROM dbo.OrderItem
            WHERE orderId = '${req.query.orderId}'`,
        (err) => {
            if (err) console.error(err.message);
        }
    );
    request.on("requestCompleted", () => {
        const request = new Request(
            `DELETE FROM dbo.OrderCase
        WHERE orderId = '${req.query.orderId}'`,
            (err) => {
                if (err) console.error(err.message);
            }
        );
        connection.execSql(request);
    });
    connection.execSql(request);
});
