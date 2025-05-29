import cv2
import threading
import os
import time
import json
import random
import shutil
import base64
from flask import send_file

from roboflow import Roboflow
from flask import Flask, jsonify, Response, send_from_directory,request
from pypylon import pylon
from flask_cors import CORS
from flask import send_from_directory 
from flasgger import Swagger
from ultralytics import YOLO

app = Flask(__name__)

# Load model YOLOv8 đã train
model = YOLO("./yolov8n.pt")

# ===================================== Setup cấu trúc cho việc xử lý ảnh =====================================
# Đường dẫn tới thư mục chứa ảnh
dataset_dir = "./dataset/train/images"
labels_dir = "./dataset/train/labels"

# Tạo các thư mục train, val, test nếu chưa có
for folder in ['train', 'valid', 'test']:
    os.makedirs(f'./dataset/{folder}/images', exist_ok=True)
    os.makedirs(f'./dataset/{folder}/labels', exist_ok=True)

# Lấy danh sách các ảnh
all_images = os.listdir(dataset_dir)
random.shuffle(all_images)

# Tỉ lệ chia dữ liệu: 70% train, 20% val, 10% test
train_size = int(0.7 * len(all_images))
val_size = int(0.2 * len(all_images))

# Di chuyển ảnh vào các thư mục
for i, img in enumerate(all_images):
    if i < train_size:
        folder = 'train'
    elif i < train_size + val_size:
        folder = 'valid'
    else:
        folder = 'test'
    
    # Di chuyển ảnh và nhãn vào thư mục tương ứng
    shutil.move(os.path.join(dataset_dir, img), os.path.join(f'./dataset/{folder}/images', img))
    shutil.move(os.path.join(labels_dir, img.replace(".jpg", ".txt")), os.path.join(f'./dataset/{folder}/labels', img.replace(".jpg", ".txt")))


# # Tải mô hình YOLOv8
model = YOLO("./yolov8n.pt")  # Thay "yolov8n.pt" bằng mô hình bạn muốn sử dụng

# # Huấn luyện mô hình
model.train(data="./dataset/data.yaml", epochs=10)  # Thay "path/to/data.yaml" bằng đường dẫn đến file YAML của bạn

# # Sử dụng mô hình để nhận diện vật thể trong hình ảnh
test_image_path ="./images/Camera Dongil_Camera 01_Camera Dongil_20250317164412_1798288.png";
results = model.predict(test_image_path)  # Thay "path/to/image.jpg" bằng đường dẫn hình ảnh bạn muốn kiểm tra

# # Hiển thị kết quả
# results.show()

# =====================================  Train Model  ===================================== 
@app.route("/api/train", methods=["POST"])
def train_model():
    try:
        data = request.json
        print("Received training data:", data)  # Debug dữ liệu nhận được

        # Đọc thông tin từ request
        epochs = int(data.get("epochs", 100))  # Mặc định là 100 nếu không có
        imgsz = int(data.get("imgsz", 640))  # Mặc định là 640
        batch = int(data.get("batch", 16))  # Mặc định là 16
        workers = int(data.get("workers", 2))  # Mặc định là 2
        dataset_path = "./dataset/data.yaml"  # Đường dẫn cố định đến file cấu hình dataset

        print(f"Dataset path: {dataset_path}")

        # Kiểm tra file dataset.yaml có tồn tại không
        if not os.path.exists(dataset_path):
            raise FileNotFoundError("Dataset configuration file not found!")

        # Huấn luyện mô hình YOLOv8
        model = YOLO("yolov8n.pt")
        model.train(
            data=dataset_path,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            workers=workers,
        )

        return jsonify({"success": True, "message": "Training started"}), 200

    except Exception as e:
        print("Error during training:", str(e))  # In lỗi ra terminal
        return jsonify({"success": False, "message": str(e)}), 500

    
# =====================================  Check python ready =====================================
@app.route('/api/check_backend_ready', methods=["GET"])
def check_backend_ready():
    global camera
    try:
        print("Backend ready.")
        return jsonify({"message":"Check backend finish"})
    except Exception as e:
        return jsonify({"message": f"Backend not ready: {e}"}),500
    
# =====================================  Connect camera ===================================== 
@app.route('/api/connect_camera', methods=['POST'])
def connect_camera():
    
    global camera
    try:
        camera = pylon.InstantCamera(pylon.TlFactory.GetInstance().CreateFirstDevice())
        camera.Open()
        print("Camera connected")
        return jsonify({"message": "Camera connected successfully"})
    except Exception as e:
        print(f"Error connecting to camera: {e}")
        return jsonify({"message": f"Error connecting to camera: {e}"}), 500

# =====================================  Disconnect camera ===================================== 
@app.route('/api/disconnect_camera', methods=['POST'])
def disconnect_camera():
    global camera
    if camera is not None:
        camera.Close()
        camera = None
        print("Camera disconnected")
        return jsonify({"message": "Camera disconnected successfully"})
    return jsonify({"message": "Camera is not connected"}), 400

# =====================================  Trigger  ===================================== 
# Thư mục để lưu hình ảnh
IMAGE_FOLDER = "images"
# os.makedirs(IMAGE_FOLDER, exist_ok=True)    

@app.route('/api/trigger', methods=['POST'])
def trigger():
    start_time = time.time()  # Thời gian bắt đầu

    try:
        # Sử dụng hình ảnh có sẵn thay vì chụp từ camera
        test_image_path = "./images/Camera Dongil_Camera 01_Camera Dongil_20250317164412_1798288.png"  # Thay đổi đường dẫn ảnh test của bạn

        if not os.path.exists(test_image_path):
            return jsonify({"message": "Test image not found"}), 404
        
        model = YOLO("./runs/detect/train4/weights/best.pt")
        # Thực hiện dự đoán với YOLO
        # results = model.predict(test_image_path)
        results = model.predict(test_image_path, imgsz=1100)


        # Đọc ảnh và vẽ bounding boxes
        image = cv2.imread(test_image_path)
        for box in results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])  # Toạ độ bounding box
            confidence = box.conf[0]  # Độ chính xác
            label = box.cls[0]  # Lớp (class)

            # Vẽ bounding box
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Hiển thị nhãn và độ chính xác
            cv2.putText(
                image,
                f"{model.names[int(label)]} {confidence:.2f}",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2,
            )

        # Chuyển đổi ảnh thành Base64 để gửi về frontend
        _, buffer = cv2.imencode('.jpg', image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')

        # Tính thời gian hoàn thành
        end_time = time.time()
        cycle_time = (end_time - start_time)

        # Trả về kết quả
        detection_count = len(results[0].boxes)
        return jsonify({
            "message": "Trigger successful",
            "processed_image_url": f"data:image/jpeg;base64,{image_base64}",
            "results": detection_count,
            "cycle_time": f"{cycle_time:.2f}"
        })

    except Exception as e:
        end_time = time.time()
        cycle_time = (end_time - start_time)
        return jsonify({
            "message": f"Error: {e}",
            "cycle_time": f"{cycle_time:.2f}"
        }), 500


# Endpoint để phục vụ hình ảnh đã xử lý
@app.route('/image/<filename>')
def serve_image(filename):
    return send_from_directory(IMAGE_FOLDER, filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
