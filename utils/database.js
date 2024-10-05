const sqlite3 = require('sqlite3').verbose();

// Abrir conexión a la base de datos
const db = new sqlite3.Database('./bingo.db');

// Crear tablas si no existen
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS Seriales (
            id_serial INTEGER PRIMARY KEY AUTOINCREMENT,
            serial TEXT NOT NULL,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS Cartones (
            id_carton INTEGER PRIMARY KEY AUTOINCREMENT,
            id_serial INTEGER,
            numeros TEXT NOT NULL,
            FOREIGN KEY (id_serial) REFERENCES Seriales(id_serial)
        )
    `);
});

// Función para generar un cartón de bingo
function generarCartonBingo() {
    let carton = Array(3).fill(null).map(() => Array(9).fill(null));
    let max_por_columna = 2;
    let rango_limites = [
        [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
        [50, 59], [60, 69], [70, 79], [80, 90]
    ];
    let contador_por_columna = Array(9).fill(0);
    let numerosRestantes = 15;

    // Primera ronda: Asegurar que cada columna tiene al menos un número
    for (let columna = 0; columna < 9 && numerosRestantes > 0; columna++) {
        let [min_val, max_val] = rango_limites[columna];
        let numero_aleatorio = Math.floor(Math.random() * (max_val - min_val + 1)) + min_val;

        carton[0][columna] = numero_aleatorio;
        contador_por_columna[columna]++;
        numerosRestantes--;
    }

    // Segunda ronda: Completar el cartón respetando el límite de 15 números
    for (let fila = 1; fila < 3 && numerosRestantes > 0; fila++) {
        let numeros_por_fila = 0;

        while (numeros_por_fila < 5 && numerosRestantes > 0) {
            let columna = Math.floor(Math.random() * 9);
            let [min_val, max_val] = rango_limites[columna];
            let numero_aleatorio = Math.floor(Math.random() * (max_val - min_val + 1)) + min_val;

            if (contador_por_columna[columna] < max_por_columna && carton[fila][columna] === null) {
                carton[fila][columna] = numero_aleatorio;
                contador_por_columna[columna]++;
                numeros_por_fila++;
                numerosRestantes--;
            }
        }
    }

    return carton;
}

// Función para guardar cartones en la base de datos
function guardarCartonesEnBaseDeDatos(serial, cartones) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO Seriales (serial) VALUES (?)`, [serial], function (err) {
            if (err) {
                return reject(err);
            }
            const idSerial = this.lastID;
            const stmt = db.prepare(`INSERT INTO Cartones (id_serial, numeros) VALUES (?, ?)`);

            cartones.forEach(carton => {
                stmt.run(idSerial, JSON.stringify(carton));
            });

            stmt.finalize(err => {
                if (err) {
                    return reject(err);
                }
                resolve(idSerial);
            });
        });
    });
}

module.exports = {
    generarCartonBingo,
    guardarCartonesEnBaseDeDatos
};
