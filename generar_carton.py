import random

# Modelo predefinido: tu lista de posiciones fijas
modelos = [
    [
        (0, 0), (2, 0), (0, 1), (1, 1), (2, 2), (1, 3), (0, 4), (1, 4),
        (2, 5), (1, 6), (2, 6), (0, 7), (1, 7), (0, 8), (2, 8)
    ],  # Modelo 1
    [
        (0, 0), (1, 0), (0, 1), (2, 1), (1, 2), (2, 2), (0, 3), (1, 3),
        (2, 4), (0, 5), (2, 5),  (0, 6), (1, 6), (2, 7), (1, 8)
    ], # Modelo 2
    [
        (2, 0), (0, 1), (0, 2), (1, 2), (2, 3), (1, 4), (2, 4), (0, 5), 
        (1, 5), (0, 6), (2, 6), (1, 7), (2, 7), (0, 8), (1, 8) 
    ], # Modelo 3
    [
        (0, 0), (2, 0), (0, 1), (1, 1), (2, 2), (1, 3), (0, 4), (1, 4),
        (2, 5), (1, 6), (2, 6), (0, 7), (1, 7), (0, 8), (2, 8)
    ]  # Modelo 4
]

# Actualización de la función generar_carton para incluir modelos
def generar_carton(id_carton, modelo):
    carton = [[None for _ in range(9)] for _ in range(3)]
    rango_limites = [(1, 10), (11, 20), (21, 30), (31, 40), (41, 50), (51, 60), (61, 70), (71, 80), (81, 90)]
    usados = set()

    # Colocar números en las posiciones del modelo
    for fila, columna in modelos[modelo]:
        numero = random.randint(*rango_limites[columna])
        while numero in usados:
            numero = random.randint(*rango_limites[columna])
        carton[fila][columna] = numero
        usados.add(numero)

    return {"idCarton": id_carton, "carton": carton}

# Ejemplo de uso:
# Generar un cartón usando el modelo 1
cantidad = int(input("Ingrese la cantidad que quiere generar: "))
while cantidad > 0:
    carton = generar_carton(cantidad, 2)  # "0" es el índice del modelo 1
    cantidad -= 1
    print(carton)
    
