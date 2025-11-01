# Guía de Integración con Supabase para Swift

## Configuración de Imágenes en EcoPoints API

La API utiliza **Supabase Storage** con un bucket privado llamado `ecopoints_images` para almacenar todas las imágenes de productos.

## 🖼️ Manejo de Imágenes

### URLs Firmadas (Signed URLs)

Debido a que el bucket es privado, todas las imágenes utilizan URLs firmadas temporales que expiran después de 1 hora por defecto.

### Estructura de Respuestas con Imágenes

```json
{
  "success": true,
  "data": {
    "id_producto": 1,
    "nombre": "Botella Ecológica",
    "descripcion": "Botella reutilizable de bambú",
    "costo_puntos": 100,
    "stock": 50,
    "imagen": "productos/uuid-generado.jpg",
    "imagen_url": "https://proyecto.supabase.co/storage/v1/object/sign/ecopoints_images/productos/uuid-generado.jpg?token=...",
    "tienda_nombre": "EcoTienda"
  }
}
```

## 📱 Implementación en Swift

### 1. Crear Producto con Imagen

```swift
func crearProductoConImagen(imagen: UIImage, producto: ProductoData) {
    guard let imageData = imagen.jpegData(compressionQuality: 0.8) else { return }

    let url = URL(string: "\(baseURL)/api/productos")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"

    let boundary = UUID().uuidString
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    var body = Data()

    // Agregar campos del producto
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"id_tienda\"\r\n\r\n".data(using: .utf8)!)
    body.append("\(producto.idTienda)\r\n".data(using: .utf8)!)

    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"nombre\"\r\n\r\n".data(using: .utf8)!)
    body.append("\(producto.nombre)\r\n".data(using: .utf8)!)

    // Agregar imagen
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"imagen\"; filename=\"producto.jpg\"\r\n".data(using: .utf8)!)
    body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
    body.append(imageData)
    body.append("\r\n".data(using: .utf8)!)
    body.append("--\(boundary)--\r\n".data(using: .utf8)!)

    request.httpBody = body

    URLSession.shared.dataTask(with: request) { data, response, error in
        // Manejar respuesta
    }.resume()
}
```

### 2. Cargar y Mostrar Imágenes

```swift
func cargarImagen(from urlString: String, completion: @escaping (UIImage?) -> Void) {
    guard let url = URL(string: urlString) else {
        completion(nil)
        return
    }

    URLSession.shared.dataTask(with: url) { data, response, error in
        guard let data = data, error == nil else {
            completion(nil)
            return
        }

        DispatchQueue.main.async {
            completion(UIImage(data: data))
        }
    }.resume()
}

// Uso en SwiftUI
AsyncImage(url: URL(string: producto.imagenUrl ?? "")) { image in
    image
        .resizable()
        .aspectRatio(contentMode: .fit)
} placeholder: {
    Image(systemName: "photo")
        .foregroundColor(.gray)
}
.frame(width: 200, height: 200)
```

### 3. Renovar URLs Expiradas

```swift
func renovarUrlImagen(imagePath: String, completion: @escaping (String?) -> Void) {
    let url = URL(string: "\(baseURL)/api/imagenes/url")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = [
        "imagePath": imagePath,
        "expiresIn": 3600 // 1 hora
    ]

    do {
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
    } catch {
        completion(nil)
        return
    }

    URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let success = json["success"] as? Bool,
              success == true,
              let dataObj = json["data"] as? [String: Any],
              let signedUrl = dataObj["signedUrl"] as? String else {
            completion(nil)
            return
        }

        completion(signedUrl)
    }.resume()
}
```

### 4. Caché de Imágenes (Recomendado)

```swift
import Foundation

class ImageCache {
    static let shared = ImageCache()
    private let cache = NSCache<NSString, UIImage>()
    private let fileManager = FileManager.default

    private init() {
        cache.countLimit = 100
    }

    func getImage(for key: String) -> UIImage? {
        return cache.object(forKey: key as NSString)
    }

    func setImage(_ image: UIImage, for key: String) {
        cache.setObject(image, forKey: key as NSString)
    }

    func loadImage(from urlString: String, completion: @escaping (UIImage?) -> Void) {
        // Verificar caché primero
        if let cachedImage = getImage(for: urlString) {
            completion(cachedImage)
            return
        }

        // Si no está en caché, descargar
        guard let url = URL(string: urlString) else {
            completion(nil)
            return
        }

        URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data,
                  error == nil,
                  let image = UIImage(data: data) else {
                completion(nil)
                return
            }

            // Guardar en caché
            self.setImage(image, for: urlString)

            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }
}
```

## 🎯 Endpoints de Imágenes

### Obtener URL Firmada Individual

```
POST /api/imagenes/url
Content-Type: application/json

{
    "imagePath": "productos/uuid-generado.jpg",
    "expiresIn": 3600
}
```

### Obtener Múltiples URLs Firmadas

```
POST /api/imagenes/urls-multiples
Content-Type: application/json

{
    "imagePaths": [
        "productos/imagen1.jpg",
        "productos/imagen2.jpg"
    ],
    "expiresIn": 3600
}
```

## 📝 Notas Importantes

1. **Expiración de URLs**: Las URLs firmadas expiran después de 1 hora por defecto
2. **Formatos Soportados**: JPG, JPEG, PNG, GIF, WEBP
3. **Tamaño Máximo**: 5MB por imagen
4. **Caché**: Implementa un sistema de caché para mejorar la performance
5. **Renovación**: Renueva las URLs antes de que expiren para evitar errores 404

## 🔧 Variables de Entorno Requeridas

En tu servidor, asegúrate de configurar:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```
