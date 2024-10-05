import cv2
import numpy as np

# Cargar la imagen original en color
imagen = cv2.imread('./prueba.jpg')

# Verificar si la imagen se cargó correctamente
if imagen is None:
    print("Error: No se pudo cargar la imagen. Verifica la ruta.")
else:
    # Convertir la imagen a espacio de color HSV para detectar el color verde
    imagen_hsv = cv2.cvtColor(imagen, cv2.COLOR_BGR2HSV)

    # Definir el rango del color verde en HSV (ajusta si es necesario)
    verde_bajo = np.array([40, 40, 40], np.uint8)
    verde_alto = np.array([80, 255, 255], np.uint8)

    # Crear una máscara para el color verde
    mascara_verde = cv2.inRange(imagen_hsv, verde_bajo, verde_alto)

    # Aplicar una operación de dilatación para mejorar la detección
    kernel = np.ones((3, 3), np.uint8)
    mascara_dilatada = cv2.dilate(mascara_verde, kernel, iterations=1)

    # Encontrar los contornos en la máscara de color verde
    contornos, _ = cv2.findContours(mascara_dilatada, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    print(contornos)
    
    # Definir las dimensiones aproximadas del guion (33x12 píxeles)
    ancho_guion = 33
    alto_guion = 12

    # Contar cuántos contornos tienen dimensiones similares a un guion
    guiones_detectados = 0

    for contorno in contornos:
        x, y, w, h = cv2.boundingRect(contorno)

        # Verificar si el contorno tiene dimensiones similares a un guion
        if ancho_guion - 10 <= w <= ancho_guion + 10 and alto_guion - 5 <= h <= alto_guion + 5:
            guiones_detectados += 1
            # Dibujar un rectángulo alrededor del guion detectado (opcional)
            cv2.rectangle(imagen, (x, y), (x + w, y + h), (0, 255, 0), 2)

    # Imprimir el número de guiones detectados
    print(f"Se detectaron {guiones_detectados} guiones.")

    # Mostrar la imagen con los guiones detectados (opcional)
    cv2.imshow('Guiones detectados', imagen)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
