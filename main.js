const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require('fs');  // Para manipulación de archivos
const XLSX = require('xlsx');
const { spawn } = require('child_process'); // Añadido para ejecutar Python
const { v4: uuidv4 } = require('uuid');  // Importar correctamente uuid

let mainWindow;
let marcarNumeroWindow;
let configWindow;
let configCartonesWindow;  // Ventana para configurar cartones
let numerosExtraidos = [];  // Inicialización correcta de numerosExtraidos
let modoAutomatico = false; // Estado del modo automático

// Crear ventana para marcar números manualmente
function createMarcarNumeroWindow() {
    marcarNumeroWindow = new BrowserWindow({
        width: 400,
        height: 300,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    marcarNumeroWindow.loadFile(path.join(__dirname, "public", "marcarNumero.html"));

    marcarNumeroWindow.on("closed", () => {
        marcarNumeroWindow = null;
    });
}

// Crear ventana para configurar cartones
function createConfigCartonesWindow() {
    configCartonesWindow = new BrowserWindow({
        width: 600,
        height: 600,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    configCartonesWindow.loadFile(path.join(__dirname, "public", "configCartones.html"));

    configCartonesWindow.on("closed", () => {
        configCartonesWindow = null;
    });
}

// Crear la ventana principal
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.whenReady().then(createMainWindow);

// Abrir la ventana de configuración de cartones
ipcMain.on('abrir-config-cartones', () => {
    if (!configCartonesWindow) {
        createConfigCartonesWindow();
    }
});


ipcMain.on('generar-cartones', (event, data) => {
    const { fechaJuego, cantidadCartones, cantidadJugadas } = data;
    const bloqueSize = 10;  // Tamaño del bloque

    // Ruta al ejecutable exportCartones.exe en la carpeta principal del proyecto
    const exePath = path.join(__dirname, 'exportCartones.exe');

    // Para cada jugada, generamos un archivo de Excel distinto y un serial distinto
    for (let jugada = 1; jugada <= cantidadJugadas; jugada++) {
        const serial = uuidv4();  // Crear un serial único para cada jugada
        const rutaExcel = path.join(__dirname, `cartones_${serial}.xlsx`);

        // Comando para ejecutar el archivo exportCartones.exe
        const pythonProcess = spawn(exePath, [cantidadCartones, bloqueSize, rutaExcel, jugada, fechaJuego]);

        // Capturar la salida del ejecutable
        pythonProcess.stdout.on('data', (data) => {
            console.log(`Salida del ejecutable: ${data}`);
            event.sender.send('progreso-cartones', data.toString());
        });

        // Capturar cualquier error en la ejecución del ejecutable
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error en el ejecutable: ${data}`);
            event.sender.send('error', { mensaje: 'Ocurrió un error al generar los cartones.' });
        });

        // Detectar cuando el proceso termina
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`Cartones generados correctamente en ${rutaExcel}`);
                event.sender.send('cartones-generados', rutaExcel);  // Enviar la ruta del archivo Excel al frontend
            } else {
                console.error(`El ejecutable terminó con un error. Código: ${code}`);
                event.sender.send('error', { mensaje: 'Error al generar los cartones.' });
            }
        });
    }
});

ipcMain.on('actualizar-ventana-espejo', (event, numerosExtraidos) => {
    if (marcarNumeroWindow) {
        marcarNumeroWindow.webContents.send('estado-actualizado', numerosExtraidos);
    }
});

// Abrir ventana para marcar números manualmente
ipcMain.on("abrir-marcar-numero", () => {
    if (!marcarNumeroWindow) {
        createMarcarNumeroWindow();

        marcarNumeroWindow.webContents.on('did-finish-load', () => {
            marcarNumeroWindow.webContents.send('estado-bingo', {
                numerosExtraidos
            });
        });
    }
});

// Crear la ventana de configuración
function createConfigWindow() {
    if (!configWindow) {
        configWindow = new BrowserWindow({
            width: 500,
            height: 400,
            parent: mainWindow,
            modal: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                preload: path.join(__dirname, "preload.js"),
            },
        });

        configWindow.loadFile(path.join(__dirname, "public", "config.html"));

        configWindow.on("closed", () => {
            configWindow = null;
        });

        // Enviar el estado del modo oscuro a la ventana de configuración cuando se cargue
        configWindow.webContents.on('did-finish-load', () => {
            const modoOscuroActivado = mainWindow.webContents.executeJavaScript(`
                localStorage.getItem('modoOscuro') === 'true';
            `);
            modoOscuroActivado.then((isDarkMode) => {
                configWindow.webContents.send('actualizar-modo-oscuro', isDarkMode);
            });
        });
    }
}

// Abrir ventana de configuración
ipcMain.on("abrir-configuracion", () => {
    if (!configWindow) {
        createConfigWindow();
    }
});

// Recibir la activación o desactivación del modo automático desde la ventana espejo
ipcMain.on('activar-modo-automatico', () => {
    modoAutomatico = !modoAutomatico;
    mainWindow.webContents.send('activar-modo-automatico', modoAutomatico);
});

// Marcar número manualmente desde la ventana espejo
ipcMain.on('marcar-numero-manualmente', (event, numeroInt) => {
    if (!numerosExtraidos.includes(numeroInt)) {
        numerosExtraidos.push(numeroInt);
    }
    mainWindow.webContents.send('marcar-numero-manualmente', numeroInt);
});

// Variables para almacenar la configuración actual
let configuracionPremios = {
    linea: 'No configurado',
    dosLineas: 'No configurado',
    bingoCompleto: 'No configurado'
};
let segundosModoAutomatico = 5;

// Listener para recibir la configuración desde el proceso renderer
ipcMain.on('guardar-configuracion', (event, data) => {
    console.log('Configuración recibida:', data);  // Esto te ayudará a verificar si los datos llegan bien
    
    // Actualiza la configuración de premios y el tiempo del modo automático
    configuracionPremios = {
        linea: data.lineaPremio,
        dosLineas: data.dosLineasPremio,
        bingoCompleto: data.bingoCompletoPremio
    };
    segundosModoAutomatico = data.segundosModoAutomatico;

    // Envía los datos al renderizador para actualizar los premios y los segundos del modo automático
    mainWindow.webContents.send('actualizar-premios', configuracionPremios);
    mainWindow.webContents.send('actualizar-segundos-modo-automatico', segundosModoAutomatico);
});

// Reiniciar el juego
ipcMain.on("reiniciar-bingo", () => {
    numerosExtraidos = [];
    modoAutomatico = false;
    
    mainWindow.webContents.send('reiniciar-juego');

    if (marcarNumeroWindow && marcarNumeroWindow.webContents) {
        marcarNumeroWindow.webContents.send('reiniciar-juego');
    }
});

// Sincronizar el modo oscuro entre ventanas
ipcMain.on('actualizar-modo-oscuro', (event, modoOscuroActivado) => {
    if (marcarNumeroWindow && marcarNumeroWindow.webContents) {
        marcarNumeroWindow.webContents.send('actualizar-modo-oscuro', modoOscuroActivado);
    }
});

ipcMain.on('cargar-cartones', (event, serial) => {
    // Definir la ruta de la carpeta del serial
    const serialFolder = path.join(__dirname, 'seriales', serial);

    // Comprobar si la carpeta del serial existe
    if (fs.existsSync(serialFolder)) {
        // Buscar el archivo JSON con el patrón esperado
        const archivos = fs.readdirSync(serialFolder);
        const archivoCartones = archivos.find(file => file.includes('_cartones_final.json'));

        if (archivoCartones) {
            const jsonFilePath = path.join(serialFolder, archivoCartones);

            try {
                // Leer y parsear el archivo JSON
                const cartonesData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

                // Extraer los arrays de cartones, ignorando otras propiedades como idCarton
                const cartonesSinId = cartonesData.map(cartonObj => cartonObj.carton);

                console.log(`Cartones cargados exitosamente para el serial: ${serial}`);
                console.log(cartonesSinId);  // Verificación para ver si los cartones están cargados correctamente

                // Enviar los cartones al frontend
                event.sender.send('cartones-cargados', { serial, cartones: cartonesSinId });
            } catch (error) {
                console.error(`Error al leer el archivo de cartones para el serial: ${serial}`, error);
                event.sender.send('error', { mensaje: 'Error al cargar los cartones. Archivo corrupto o formato inválido.' });
            }
        } else {
            console.log(`No se encontró un archivo con el patrón "_cartones_final.json" en la carpeta del serial: ${serial}`);
            event.sender.send('error', { mensaje: 'No se encontraron cartones con ese serial.' });
        }
    } else {
        console.log(`Error: No se encontró la carpeta del serial: ${serial}`);
        event.sender.send('error', { mensaje: 'No se encontró la carpeta del serial.' });
    }
});


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.disableHardwareAcceleration();

