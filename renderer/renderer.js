const { ipcRenderer } = require('electron');
const fs = require('fs');

let numerosExtraidos = [];
let numeros = Array.from({ length: 90 }, (_, i) => i + 1); // Números del 1 al 90
let modoAutomatico = false;
let intervaloAutomatico = null;
let cronometroActivo = false;
let tiempoTranscurrido = 0;
let intervaloCronometro;

const gridNumeros = document.getElementById("grid-numeros");
const listaNumeros = document.getElementById("lista-numeros");
const overlay = document.getElementById("overlay");

// Configuración por defecto
let configuracion = {
    premioLinea: 'No configurado',
    premioDosLineas: 'No configurado',
    premioBingo: 'No configurado',
    tiempoAutomatico: 3 // Valor por defecto de 3 segundos
};

// Generar el tablero de bingo
function generarTablero() {
    gridNumeros.innerHTML = ""; // Limpiar tablero
    for (let i = 1; i <= 90; i++) {
        const numero = document.createElement("div");
        numero.classList.add("numero");
        numero.textContent = i;
        gridNumeros.appendChild(numero);
    }
}

// Actualizar tablero con los números extraídos
function actualizarTablero() {
    const numerosDivs = document.querySelectorAll(".numero");
    numerosDivs.forEach(div => {
        if (numerosExtraidos.includes(parseInt(div.textContent))) {
            div.classList.add("extraido");
        } else {
            div.classList.remove("extraido");
        }
    });
}

// Mostrar el número extraído superpuesto en el centro del tablero
function mostrarNumeroSuperpuesto(numero) {
    const gridContainer = document.getElementById("grid-numeros-container");

    // Obtener las dimensiones y posición del contenedor del bingo
    const gridRect = gridContainer.getBoundingClientRect();

    // Ajustar el centrado del overlay dentro del contenedor de números
    overlay.style.top = `${gridRect.top + window.scrollY + (gridRect.height / 2)}px`;
    overlay.style.left = `${gridRect.left + window.scrollX + (gridRect.width / 2)}px`;

    overlay.style.transform = "translate(-50%, -50%)";

    // Mostrar el número en el overlay
    overlay.innerText = numero;
    overlay.style.display = "block";

    // Ocultar el overlay después de 2 segundos
    setTimeout(() => {
        overlay.style.display = "none";
    }, 2000);
}

// Actualizar la lista de los últimos 4 números extraídos
function actualizarListaNumeros() {
    listaNumeros.innerHTML = ""; // Limpiar la lista
    const ultimosNumeros = numerosExtraidos.slice(-4).reverse();
    ultimosNumeros.forEach((numero) => {
        const nuevoNumero = document.createElement("li");
        nuevoNumero.classList.add("numero-extraido");
        nuevoNumero.textContent = numero;
        listaNumeros.appendChild(nuevoNumero);
    });
}

function mostrarNotificacion(mensaje) {
    const notificacionDiv = document.getElementById('mensajeNotificacion');
    notificacionDiv.textContent = mensaje;

    // Mostrar la notificación por 3 segundos y luego borrarla
    setTimeout(() => {
        notificacionDiv.textContent = ''; // Limpiar mensaje después de un tiempo
    }, 3000);
}

// Array para rastrear los cartones que ya han completado una fila
let cartonesConFilaCompletada = new Set();
// Variable global para almacenar el serial del juego
let serialCartones = '';


function extraerNumero(numeroSeleccionado = null) {
    if (!cronometroActivo) {
        iniciarCronometro();  // Inicia el cronómetro si no está activo
    }

    if (numeroSeleccionado === null) {
        if (numeros.length === 0) {
            alert("Ya no hay más números.");
            detenerCronometro();  // Detenemos el cronómetro cuando no haya más números
            return;
        }
        const indice = Math.floor(Math.random() * numeros.length);
        numeroSeleccionado = numeros.splice(indice, 1)[0];
    } else {
        numeros.splice(numeros.indexOf(numeroSeleccionado), 1);
    }

    numerosExtraidos.push(numeroSeleccionado);
    console.log("Número extraído:", numeroSeleccionado);  // Debugging
    actualizarListaNumeros();
    actualizarTablero();
    mostrarNumeroSuperpuesto(numeroSeleccionado);
    ipcRenderer.send('actualizar-ventana-espejo', numerosExtraidos);

    // Verificar cartones cargados
    if (window.cartones && window.cartones.length > 0) {
        for (let i = 0; i < window.cartones.length; i++) {
            let carton = window.cartones[i]; // Accede al cartón
            console.log(`Verificando cartón ${i + 1}...`);  // Debugging

            if (!cartonesConFilaCompletada.has(i)) {
                // Verificar si se completó una fila
                if (verificarFilaCompletada(carton, numerosExtraidos)) {
                    console.log(`¡El cartón en la posición ${i + 1} completó una fila!`);
                    mostrarNotificacion(`¡El cartón en la posición ${i + 1} completó una fila!`);
                    reproducirSonidoFilaCompletada();  // Reproduce el sonido
                    cartonesConFilaCompletada.add(i);

                    // Guardar la información en un archivo txt usando el serial del cartón
                    const texto = `carton ${i + 1} linea\n`;
                    const nombreArchivo = `cartones_completados_${serialCartones}.txt`;  // Usar el serial para el nombre
                    fs.appendFile(nombreArchivo, texto, (err) => {
                        if (err) {
                            console.error('Error al escribir en el archivo:', err);
                        } else {
                            console.log('Información guardada en el archivo:', nombreArchivo);
                        }
                    });
                }
            }

            // Verificar si se completó el bingo
            if (verificarBingoCompletado(carton, numerosExtraidos)) {
                console.log(`¡El cartón en la posición ${i + 1} completó el bingo!`);
                mostrarNotificacion(`¡El cartón en la posición ${i + 1} completó el bingo!`);
                mostrarCelebracionBingo(i + 1);  // Pasa el número del cartón ganador
                
                // Detener el modo automático y cronómetro si estaban activos
                if (modoAutomatico) {
                    clearInterval(intervaloAutomatico);  // Detenemos el intervalo automático
                    modoAutomatico = false;
                    console.log('Modo automático detenido por bingo');
                }

                // Restaurar el estado del botón
                const boton = document.getElementById("modoAutomaticoBtn");
                boton.textContent = "Activar Modo Automático";  // Cambiar el texto del botón al estado original
                boton.classList.remove("boton-desactivado");  // Remover cualquier clase que lo ponga en estado 'desactivado'

                detenerCronometro();  // Detener el cronómetro si se completa el bingo
                finalizarBingo();  // Finalizar el juego si se completa un bingo
                break;  // Si ya se completó un bingo, no es necesario seguir revisando
            }
        }
    } else {
        console.log("No hay cartones cargados.");
    }
}

// Función para verificar si un cartón ha completado una fila
function verificarFilaCompletada(carton, numerosExtraidos) {
    console.log("Verificando filas del cartón:", carton); // Debugging
    for (let fila of carton) {
        // Filtrar solo los números válidos (no null)
        let numerosValidos = fila.filter(numero => numero !== null);

        // Verificar si la fila tiene exactamente 5 números y si esos números están en los numerosExtraidos
        if (numerosValidos.length === 5 && numerosValidos.every(numero => numerosExtraidos.includes(numero))) {
            return true; // Fila completada
        }
    }
    return false; // Ninguna fila completada
}

// Función para verificar si se ha completado el bingo (todo el cartón)
function verificarBingoCompletado(carton, numerosExtraidos) {
    console.log("Verificando si el cartón completó el bingo:", carton); // Debugging
    return carton.every(fila => {
        let numerosValidos = fila.filter(numero => numero !== null);
        return numerosValidos.every(numero => numerosExtraidos.includes(numero));
    });
}

// Crear una variable global para almacenar el objeto de sonido
let sonidoFilaCompletada = null;

function reproducirSonidoFilaCompletada() {
    // Si el objeto de sonido no ha sido inicializado, lo creamos
    if (!sonidoFilaCompletada) {
        sonidoFilaCompletada = new Audio('../assets/mario-coin.mp3'); // Asegúrate de que el archivo esté en la carpeta 'assets'
    }

    // Solo reproducimos el sonido si no se está reproduciendo actualmente
    if (sonidoFilaCompletada.paused) {
        sonidoFilaCompletada.play();
    } else {
        // Si ya se está reproduciendo, opcionalmente podemos reiniciarlo
        sonidoFilaCompletada.currentTime = 0; // Descomentar si deseas reiniciar el sonido cada vez que se llama
    }
}

function lanzarConfeti() {
    confetti({
        particleCount: 200,
        spread: 60,
        origin: { y: 0.6 }
    });
}

function mostrarCelebracionBingo(cartonNumero) {
    // Crear un overlay que bloquea la interactividad
    const bloqueoInteraccion = document.createElement("div");
    bloqueoInteraccion.style.position = "fixed";
    bloqueoInteraccion.style.top = "0";
    bloqueoInteraccion.style.left = "0";
    bloqueoInteraccion.style.width = "100vw";
    bloqueoInteraccion.style.height = "100vh";
    bloqueoInteraccion.style.backgroundColor = "rgba(0, 0, 0, 0.5)";  // Fondo semi-transparente
    bloqueoInteraccion.style.zIndex = "999";  // Un valor alto para estar por encima de todo
    document.body.appendChild(bloqueoInteraccion);

    // Mostrar el mensaje de BINGO en pantalla junto con el número del cartón
    const overlayCelebracion = document.createElement("div");
    overlayCelebracion.style.position = "fixed";
    overlayCelebracion.style.top = "50%";
    overlayCelebracion.style.left = "50%";
    overlayCelebracion.style.transform = "translate(-50%, -50%)";
    overlayCelebracion.style.fontSize = "10rem";  // Ajusta el tamaño de la fuente según sea necesario
    overlayCelebracion.style.color = "gold";
    overlayCelebracion.style.fontWeight = "bold";
    overlayCelebracion.style.fontFamily = "'Ethnocentric', sans-serif";
    overlayCelebracion.style.zIndex = "1000";
    overlayCelebracion.style.textAlign = "center";  // Centra el texto horizontalmente
    overlayCelebracion.style.whiteSpace = ""; // Evitar que el texto se divida en líneas
    overlayCelebracion.style.width = "100%";  // Asegura que el contenedor ocupe todo el ancho
    overlayCelebracion.innerText = `¡BINGO! Cartón ${cartonNumero}`;
    document.body.appendChild(overlayCelebracion);

    // Lanza confeti
    lanzarConfeti();

    // Ocultar el festejo después de unos segundos y restaurar la interactividad
    setTimeout(() => {
        document.body.removeChild(overlayCelebracion);  // Eliminar el mensaje de celebración
        document.body.removeChild(bloqueoInteraccion);  // Restaurar la interactividad al quitar el overlay de bloqueo
    }, 15000);  // El tiempo que dura la animación, ajustable según tus preferencias
}

function finalizarBingo() {
    detenerCronometro();  // Detener el cronómetro
    const horas = Math.floor(tiempoTranscurrido / 3600);
    const minutos = Math.floor((tiempoTranscurrido % 3600) / 60);
    const segundos = tiempoTranscurrido % 60;

    console.log(`Tiempo total transcurrido: ${pad(horas)} horas, ${pad(minutos)} minutos, ${pad(segundos)} segundos`);

    // Aquí podrías enviar una notificación al backend de que el juego ha finalizado
    ipcRenderer.send('finalizar-bingo', tiempoTranscurrido);
}

document.getElementById("finalizarBingoBtn").addEventListener("click", finalizarBingo);

// Marcar número manualmente
// document.getElementById("marcarNumeroBtn").addEventListener("click", () => {
//     const numerosDisponibles = numeros.filter(n => !numerosExtraidos.includes(n));
//     if (numerosDisponibles.length === 0) {
//         alert("No hay números disponibles para marcar.");
//         return;
//     }
//     const numeroSeleccionado = prompt("Selecciona un número para marcar manualmente: " + numerosDisponibles.join(", "));
//     if (numeroSeleccionado && !isNaN(parseInt(numeroSeleccionado))) {
//         extraerNumero(parseInt(numeroSeleccionado));
//     } else {
//         alert("Número no válido.");
//     }
// });

// Activar/desactivar modo automático
function toggleModoAutomatico() {
    modoAutomatico = !modoAutomatico;
    const boton = document.getElementById("modoAutomaticoBtn");

    if (modoAutomatico) {
        boton.textContent = "Desactivar Modo Automático";
        console.log('Usando intervalo de:', configuracion.tiempoAutomatico);  // Asegúrate de que los segundos correctos se estén usando

        // Establece el intervalo según la configuración
        intervaloAutomatico = setInterval(() => extraerNumero(), configuracion.tiempoAutomatico * 1000);
    } else {
        boton.textContent = "Activar Modo Automático";
        clearInterval(intervaloAutomatico);  // Detiene el intervalo cuando se desactiva el modo automático
    }
}

// Evento para abrir la ventana espejo y enviarle el estado inicial
// document.getElementById("marcarNumeroBtn").addEventListener("click", () => {
//     ipcRenderer.send("abrir-marcar-numero");
// });

// Sincronización con el modo oscuro
const modoOscuroBtn = document.getElementById("modoOscuroBtn");
if (localStorage.getItem('modoOscuro') === 'true') {
    document.body.classList.add('modo-oscuro');
    modoOscuroBtn.checked = true;
}
modoOscuroBtn.addEventListener('change', () => {
    document.body.classList.toggle('modo-oscuro');
    const modoOscuroActivado = document.body.classList.contains('modo-oscuro');
    localStorage.setItem('modoOscuro', modoOscuroActivado);
    ipcRenderer.send('actualizar-modo-oscuro', modoOscuroActivado);
});

function iniciarCronometro() {
    if (!cronometroActivo) {
        cronometroActivo = true;
        tiempoTranscurrido = 0;
        document.getElementById("contador-tiempo").style.display = "block";  // Mostrar el cronómetro
        intervaloCronometro = setInterval(() => {
            tiempoTranscurrido++;
            mostrarTiempo();
        }, 1000);
    }
}

function mostrarTiempo() {
    const cronometroElem = document.getElementById("contador-tiempo");
    const horas = Math.floor(tiempoTranscurrido / 3600);
    const minutos = Math.floor((tiempoTranscurrido % 3600) / 60);
    const segundos = tiempoTranscurrido % 60;
    cronometroElem.innerText = `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}

function pad(num) {
    return num < 10 ? "0" + num : num;
}

function detenerCronometro() {
    clearInterval(intervaloCronometro);  // Detiene el cronómetro
    cronometroActivo = false;
}

// Variable global para contar las veces que se ha jugado el bingo
let vecesJugadas = 1;

function reiniciarJuego() {
    // Incrementar el contador de veces jugadas
    vecesJugadas++;

    // Actualizar el texto que muestra el número de veces jugadas en la interfaz
    document.getElementById('vecesJugadas').innerText = `${vecesJugadas}`;

    // Reiniciar los números extraídos y el tablero
    numerosExtraidos = [];
    numeros = Array.from({ length: 90 }, (_, i) => i + 1);

    generarTablero();  // Regenerar el tablero de números
    ipcRenderer.send('actualizar-ventana-espejo', numerosExtraidos);  // Actualizar la ventana espejo si existe
}


document.getElementById("reiniciarBtn").addEventListener("click", reiniciarJuego);
ipcRenderer.on('reiniciar-juego', reiniciarJuego);

document.getElementById("generarCartonesBtn").addEventListener("click", () => {
    const fechaJuego = document.getElementById("fechaJuego").value;
    const cantidadCartones = parseInt(document.getElementById("cantidadCartones").value);
    const cantidadJugadas = parseInt(document.getElementById("cantidadJugadas").value);

    if (!fechaJuego) {
        alert("Por favor, seleccione una fecha.");
        return;
    }
    if (isNaN(cantidadCartones) || cantidadCartones < 1 || cantidadCartones > 5000) {
        alert("Por favor, ingrese una cantidad válida de cartones (entre 1 y 5000).");
        return;
    }
    if (isNaN(cantidadJugadas) || cantidadJugadas < 1) {
        alert("Por favor, ingrese una cantidad válida de jugadas.");
        return;
    }

    // Enviar datos al backend
    ipcRenderer.send('generar-cartones', { fechaJuego, cantidadCartones, cantidadJugadas });
});

document.getElementById("cargarCartonesBtn").addEventListener("click", () => {
    const serial = document.getElementById("serialInput").value;
    if (serial === "") {
        alert("Por favor, ingrese un serial.");
        return;
    }

    // Enviar evento al backend para cargar los cartones con el serial ingresado
    ipcRenderer.send('cargar-cartones', serial);
});

// Recibir respuesta desde el main cuando los cartones se generan
ipcRenderer.on('cartones-generados', (event, cartones) => {
    console.log('Cartones generados:', cartones);
    mostrarCartones(cartones);
});

ipcRenderer.on('cartones-cargados', (event, data) => {
    console.log('Cartones recibidos:', data.cartones);
    window.cartones = data.cartones;  // Guardar los cartones cargados en window para acceder luego
    serialCartones = data.serial;     // Guardar el serial en una variable global
    console.log('Cartones almacenados en window:', window.cartones);  // Verifica si están almacenados correctamente
    mostrarCartones(data.cartones, data.serial);  // Mostrar los cartones en la interfaz
});

// Listener para actualizar los premios
ipcRenderer.on('actualizar-premios', (event, premios) => {
    document.getElementById('premios').innerHTML = `
        <h2>Premios</h2>
        <ul>
            <li>Línea: ${premios.linea}</li>
            <li>Bingo completo: ${premios.bingoCompleto}</li>
        </ul>
    `;
});

// Listener para actualizar los segundos del modo automático
ipcRenderer.on('actualizar-segundos-modo-automatico', (event, segundos) => {
    console.log('Tiempo del modo automático actualizado a:', segundos);  // Verifica que los segundos lleguen bien
    configuracion.tiempoAutomatico = segundos;  // Actualiza la configuración local
});

const confettiScript = document.createElement('script');
confettiScript.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js";
document.head.appendChild(confettiScript);

// Mostrar los cartones en el HTML
function mostrarCartones(cartones, serial = '') {
    const container = document.getElementById('cartonesGenerados');
    container.innerHTML = '';

    cartones.forEach((carton, index) => {
        let cartonHtml = `<div class="carton"><h3>Cartón ${index + 1}</h3>`;
        carton.numeros.forEach(fila => {
            let filaHtml = '<div class="fila">';
            fila.forEach(numero => {
                filaHtml += `<div class="celda">${numero || ''}</div>`;
            });
            filaHtml += '</div>';
            cartonHtml += filaHtml;
        });
        cartonHtml += '</div>';
        container.innerHTML += cartonHtml;
    });

    if (serial) {
        document.getElementById("serialDisplay").textContent = `Cartones Generados (Serial: ${serial})`;
    }
}

// toggleModoAutomatico
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("modoAutomaticoBtn").addEventListener("click", toggleModoAutomatico);
    document.getElementById("extraerNumeroBtn").addEventListener("click", () => extraerNumero());
    document.getElementById("reiniciarBtn").addEventListener("click", reiniciarJuego);
    document.getElementById("configuracionBtn").addEventListener("click", () => ipcRenderer.send("abrir-configuracion"));
    // document.getElementById("marcarNumeroBtn").addEventListener("click", () => ipcRenderer.send("abrir-marcar-numero"));
});

// Recibir el serial generado en el frontend
ipcRenderer.on('cartones-generados', (event, rutaExcel) => {
    alert(`Los cartones se generaron correctamente. Archivo generado: ${rutaExcel}`);
});

ipcRenderer.on('error', (event, data) => {
    alert(data.mensaje);  // Mostrar error si ocurrió algún problema en el script Python
});

ipcRenderer.on('progreso-cartones', (event, progress) => {
    document.getElementById('progresoCartones').innerText = `Progreso: ${progress.toFixed(2)}%`;
});

// Inicializar el tablero al cargar
generarTablero();
