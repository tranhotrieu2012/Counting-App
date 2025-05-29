import cv2
import threading
import os
import time
import json
import random
import shutil
import base64

from roboflow import Roboflow
from flask import Flask, jsonify, Response, send_from_directory,request
from pypylon import pylon
from flask_cors import CORS
from flask import send_from_directory 
from flasgger import Swagger
from ultralytics import YOLO



# Flask
app = Flask(__name__)
swagger = Swagger(app)
# CORS cho phép frontend (Electron) kết nối với API
CORS(app)


camera = None
is_live = False  # Biến kiểm soát việc live
lock = threading.Lock()  # Khóa để đồng bộ trạng thái

# Flask
app = Flask(__name__)
# CORS cho phép frontend (Electron) kết nối với API
CORS(app)
camera = None
is_live = False  # Biến kiểm soát việc live
lock = threading.Lock()  # Khóa để đồng bộ trạng thái



# =====================================  Xử lý ảnh =====================================                 

# rf = Roboflow(api_key="48CBzmZdDcLQN3tvNyLz")
# project = rf.workspace("trieu-l6awr").project("dongil_2")
# version = project.version(5)
# dataset = version.download("yolov8")
# # Đường dẫn tới thư mục chứa ảnh
# dataset_dir = "./Dongil_2-5/train/images"
# labels_dir = "./Dongil_2-5/train/labels"

# # Tạo các thư mục train, val, test nếu chưa có
# for folder in ['train', 'valid', 'test']:
#     os.makedirs(f'./Dongil_2-5/{folder}/images', exist_ok=True)
#     os.makedirs(f'./Dongil_2-5/{folder}/labels', exist_ok=True)

# # Lấy danh sách các ảnh
# all_images = os.listdir(dataset_dir)
# random.shuffle(all_images)

# # Tỉ lệ chia dữ liệu: 70% train, 20% val, 10% test
# train_size = int(0.7 * len(all_images))
# val_size = int(0.2 * len(all_images))

# # Di chuyển ảnh vào các thư mục
# for i, img in enumerate(all_images):
#     if i < train_size:
#         folder = 'train'
#     elif i < train_size + val_size:
#         folder = 'valid'
#     else:
#         folder = 'test'
    
#     # Di chuyển ảnh và nhãn vào thư mục tương ứng
#     shutil.move(os.path.join(dataset_dir, img), os.path.join(f'./Dongil_2-5/{folder}/images', img))
#     shutil.move(os.path.join(labels_dir, img.replace(".jpg", ".txt")), os.path.join(f'./Dongil_2-5/{folder}/labels', img.replace(".jpg", ".txt")))


# Tải mô hình YOLOv8
# model = YOLO("./runs/detect/train/weights/best.pt")  # Thay "yolov8n.pt" bằng mô hình bạn muốn sử dụng

# Huấn luyện mô hình
# model.train(data="./Dongil_2-5/data.yaml", epochs=100)  # Thay "path/to/data.yaml" bằng đường dẫn đến file YAML của bạn

# Sử dụng mô hình để nhận diện vật thể trong hình ảnh
# test_image_path ="../images/UpCamera-21643460-_20241120_162810940_0357_png.rf.3c2851bc05d0101e2dde0d5108147edd.jpg";
# results = model.predict(test_image_path)  # Thay "path/to/image.jpg" bằng đường dẫn hình ảnh bạn muốn kiểm tra

# Hiển thị kết quả
# results.show()

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


# =====================================  Live camera ===================================== 
@app.route('/api/live')
def live():
    global camera, is_live
    if camera is None:
        return jsonify({"message": "Camera is not connected"}), 400

    with lock:
        if is_live:
            return jsonify({"message": "Live stream is already running"}), 400
        is_live = True

    def generate():
        global is_live
        try:
            while True:
                with lock:
                    if not is_live:
                        break

                grab_result = camera.GrabOne(1000)
                if grab_result.GrabSucceeded():
                    frame = grab_result.Array
                    _, jpeg = cv2.imencode('.jpg', frame)
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                grab_result.Release()
        except Exception as e:
            print(f"Live error: {e}")
        finally:
            with lock:
                is_live = False

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

# =====================================  Stop live ===================================== 
@app.route('/api/stop_live', methods=['POST'])
def stop_live():
    global is_live
    with lock:
        if not is_live:
            return jsonify({"message": "No live stream is running"}), 400
        is_live = False
    print("Live stream stopped")
    return jsonify({"message": "Live stream stopped successfully"})


# =====================================  Trigger  ===================================== 
# Thư mục để lưu hình ảnh
IMAGE_FOLDER = "images"
# os.makedirs(IMAGE_FOLDER, exist_ok=True)

@app.route('/api/trigger', methods=['POST'])
def trigger():
    global camera
    if camera is None:
        return jsonify({"message": "Camera is not connected"}), 400

    start_time = time.time() # Thời gian bắt đầu
    try:
        # Kích hoạt camera và chụp ảnh
        grab_result = camera.GrabOne(1000)
        if grab_result.GrabSucceeded():
            image = grab_result.Array
            grab_result.Release()

            # Chuyển đổi mảng thành file tạm thời
            _, buffer = cv2.imencode('.jpg',image)
            temp_image_path = 'temp_image.jpg'
            with open(temp_image_path, 'wb') as temp_file:
                temp_file.write(buffer)

            # Thực hiện dự đoán với Yolo
            results = model.predict(temp_image_path)

            # Đọc ảnh và vẽ bounding boxes
            image = cv2.imread(temp_image_path)
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])  # Toạ độ của bounding box
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

            # Chuyển đổi ảnh thành Base64
            _, buffer = cv2.imencode('.jpg', image)
            image_base64 = base64.b64encode(buffer).decode('utf-8')

            # Tính thời gian hoàn thành
            end_time = time.time() # Thời gian kết thúc
            cycle_time = (end_time - start_time)

            # Trả về kết quả
            detection_count = len(results[0].boxes)
            return jsonify({
                "message": "Trigger successful",
                "processed_image_url": f"data:image/jpeg;base64,{image_base64}",
                "results": detection_count,
                "cycle_time": f"{cycle_time:.2f}"
            })
        else:
            return jsonify({"message": "Error in trigger"}), 500
    except Exception as e:
        end_time = time.time()
        cycle_time = (end_time - start_time)
        return jsonify({
            "message": f"Error: {e}",
            "cycle_time":f"{cycle_time:.2f}"
        }), 500


# Endpoint để phục vụ hình ảnh đã xử lý
@app.route('/image/<filename>')
def serve_image(filename):
    return send_from_directory(IMAGE_FOLDER, filename)



# =====================================  Thay đổi thông số camera ===================================== 
@app.route('/api/set_settings', methods=['POST'])
def set_camera_settings():
    global camera
    if camera is None:
        return jsonify({"message": "Camera is not connected!"}), 400
    try:
        data = request.json
        
        width = int(data.get('width', 1000) or 1000)
        height = int(data.get('height', 100) or 100)
        offsetX = int(data.get('offsetX', 0) or 0)
        offsetY = int(data.get('offsetY', 0) or 0)
        gain = int(data.get('gain', 0) or 0)
      
        exposure = int(data.get('exposure', 1000) or 1000)
        
        # Lấy thông tin min ,max, inc cho exposure time raw
        min_exposure = camera.ExposureTimeRaw.GetMin()
        max_exposure = camera.ExposureTimeRaw.GetMax()
        inc_exposure = camera.ExposureTimeRaw.GetInc()
        # Kiểm tra giá trị hợp lệ
        if exposure < min_exposure or exposure > max_exposure:
            return jsonify({"message": f"Exposure value must be between {min_exposure} and {max_exposure}"}), 400
        # Điều chỉnh giá trị để chia hết cho Increment
        valid_exposure = min_exposure + ((exposure - min_exposure) // inc_exposure) * inc_exposure

        # Thay đổi thông số camera
        camera.Width.SetValue(width)
        camera.Height.SetValue(height)
        camera.OffsetX.SetValue(offsetX)
        camera.OffsetY.SetValue(offsetY)
        camera.ExposureTimeRaw.SetValue(valid_exposure)
        camera.GainRaw.SetValue(gain)


        return jsonify({'message': 'Settings applied successfully!'})
    except Exception as e:
        print(f"Error applying settings: {e}")
        return jsonify({"message": f"Error applying settings: {e}"}), 500

# =====================================  Lấy thông số camera ===================================== 
@app.route('/api/get_settings', methods=['GET'])
def get_camera_settings():
    global camera
    if camera is None:
        return jsonify({"message":"Camera is not connected!"}),400
    try:
       # Lấy thông số hiện tại từ camera
       settings = {
            # CCD    
           "width": camera.Width.GetValue(),
           "height": camera.Height.GetValue(),
           "offsetX": camera.OffsetX.GetValue(),
           "offsetY": camera.OffsetY.GetValue(),
           "gain": camera.GainRaw.GetValue(),
           "exposure": camera.ExposureTimeRaw.GetValue(),

       }
       # Trả thông số về fontend
       return jsonify({"message":"Camera settings successfully!","settings": settings})
    except Exception as e:
        print(f"Error applying settings: {e}")
        return jsonify({"message": f"Error applying settings: {e}"}),500
    
# =====================================  Test xử lý biên ảnh (Canny)  =====================================
@app.route('/api/grab_check', methods=['POST'])
def grabCheck():
    global camera
    if camera is None:
        return jsonify({"message":"Camera is not connected!"}),400
    try:
        grab_result = camera.GrabOne(1000)
        if grab_result.GrabSucceeded():
            image = grab_result.Array
            timestamp = int(time.time())

            # Tạo đường dẫn đầy đủ cho hình ảnh
            original_image_filename = f"original_image_{timestamp}.jpg"
            original_image_path = os.path.join(IMAGE_FOLDER, original_image_filename)
            processed_image_filename = f"processed_image_{timestamp}.jpg"
            processed_image_path  = os.path.join(IMAGE_FOLDER, processed_image_filename)

            # Lưu hình ảnh và đã xử lý
            cv2.imwrite(original_image_path, image)
            edges = cv2.Canny(image, 100,200)
            cv2.imwrite(processed_image_path, edges)

            grab_result.Release()

            # Trả về đường dẫn URL cho hình ảnh
            return jsonify({
                "original_image": f"/image/{original_image_filename}",
                "processed_image": f"/image/{processed_image_filename}"
            })
    except Exception as e:
        return jsonify({"message":f"Error: {e}"}),500




# ===================================== Start Grab =====================================
@app.route('/api/start_grab', methods = ['POST'])
def start_grab():
    global camera
    if camera is None:
        return jsonify({"message":"Camera is not connected"}),400
    start_time = time.time()
    try:
        # Kích hoạt camera và chụp ảnh
        grab_result = camera.GrabOne(500)
        if grab_result.GrabSucceeded():
            image = grab_result.Array
            grab_result.Release()

            # Chuyển đổi mảng thành file tạm thời
            _, buffer = cv2.imencode('.jpg', image)
            temp_image_path = 'temp_image.jpg'
            with open(temp_image_path,'wb') as temp_file:
                temp_file.write(buffer)

            # Thực hiện dự đoán với Yolo
            results = model.predict(temp_image_path)

            # Đọc ảnh và vẽ bounding boxes
            image = cv2.imread(temp_image_path)
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0]) # Tọa độ của bounding box
                confidence = box.conf[0] # Độ chính xác
                label = box.cls[0] 

                # Vẽ bounding box
                cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)

                # Hiển thị nhãn và độ chính xác
                cv2.putText(
                    image,
                    f"{model.names[int(label)]} {confidence:.2f}",
                    (x1, y1 -10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    2,
                )
            # Chuyển đổi thành base64
            _, buffer = cv2.imencode('.jpg', image)
            image_base64 = base64.b64encode(buffer).decode('utf-8')

            end_time = time.time()
            cycle_time = end_time - start_time

            # Trả về kế quả
            detection_count = len(results[0].boxes)
            return jsonify({
                "message":"Start grab successful",
                "processed_image_url": f"data:image/jpeg;base64,{image_base64}",
                "results":detection_count,
                "cycle_time": f"{cycle_time:.2f}"
            })
        else:
            return jsonify({
                "message":"Error in trigger",
            }),500

    except Exception as e:
        end_time = time.time()
        cycle_time = end_time - start_time
        return jsonify({
            "message":f"Error: {e}",
            "cycle_time":f"{cycle_time:.2f}"
        }),500

# ===================================== Stop Grab =====================================
@app.route('/api/stop_grab', methods=['POST'])
def stop_grab():
    global is_live, last_processed_frame
    with lock:
        is_live = False  # Dừng luồng live

    if last_processed_frame is not None:
        # Tạo timestamp và tên file
        timestamp = int(time.time())
        processed_image_filename = f"processed_image_{timestamp}.jpg"
        processed_image_path = os.path.join(IMAGE_FOLDER, processed_image_filename)

        # Lưu hình ảnh cuối cùng ra file
        cv2.imwrite(processed_image_path, last_processed_frame)
        saved_image_url = f"/image/{processed_image_filename}"

        return jsonify({
            "message": "Stopped live stream and saved the last image",
            "saved_image": saved_image_url
        }), 200
    else:
        return jsonify({
            "message": "No image was captured during the live stream"
        }), 400
        
# ===================================== Save images =====================================
# Create folder images
IMAGE_FOLDER_PATH = "../images"
os.makedirs(IMAGE_FOLDER_PATH, exist_ok= True)
# Đường dẫn thư mục hình ảnh pass, error
PASS_DIR = "../images/pass"
ERROR_DIR = "../images/error"

# Tạo thư mục pass và error
os.makedirs(PASS_DIR, exist_ok=True)
os.makedirs(ERROR_DIR, exist_ok= True)
# ===== Image pass =====
@app.route('/api/image_pass', methods = ['POST'])
def image_pass():
    global camera
    if camera is None:
        return jsonify({"message":"Camera is not connected"}),400
    try:
        grab_result = camera.GrabOne(1000)
        if grab_result.GrabSucceeded():
            image = grab_result.Array
            # Tạo tên file hình ảnh
            timestamp = int(time.time()) # Thêm thời gian vào tên ảnh
            image_filename = f"image_pass_{timestamp}.jpg"
            image_path = os.path.join(PASS_DIR, image_filename)

            # Lưu ảnh vào folder pass
            cv2.imwrite(image_path, image)
            grab_result.Release()
            return jsonify({
                "message":"Save image pass successful"
            })
        else:
            return jsonify({"message":"Error save image"}),500

    except Exception as e:
        return jsonify({"message":f"Error save image: {e}"}),500
# ===== Image erro =====
@app.route('/api/image_error', methods = ['POST'])
def image_error():
    global camera
    if camera is None:
        return jsonify({"message":"Camera is not connected."}),400
    try:
       grab_result = camera.GrabOne(1000)
       if grab_result.GrabSucceeded():
            image = grab_result.Array
            # Tạo tên file hình ảnh
            timestamp = int(time.time()) # Thêm thời gian vào file hình ảnh
            image_filename = f"image_error_{timestamp}.jpg"
            image_path = os.path.join(ERROR_DIR,image_filename)

            # Lưu ảnh vào folder
            cv2.imwrite(image_path, image)
            grab_result.Release()
            return jsonify({
                "message":"Save image error successful."
            })
       else:
           return jsonify({"message":f"Error save image: {e}"}),500
              
            
    except Exception as e:
        return jsonify({"Message": "Error save image: {e}"}),500


# ===================================== Create Model =====================================
os.makedirs("models", exist_ok = True)
@app.route('/api/create_model', methods=['POST'])
def create_model():
    try:
        # Lấy dữ liệu từ yêu cầu
        data = request.json
        model_name = data.get("model_name", "default_model")  # Lấy tên model từ yêu cầu hoặc mặc định "default_model"

        # Dữ liệu mẫu của model
        model_data = {
            "DeviceInformation": {
                "DeviceName": "Basler ace acA1920-40gm",
                "DeviceModel": "acA1920-40gm",
                "DeviceVendor": "Basler",
                "DeviceVersion": "1.0",
                "SerialNumber": "123456789",
                "FirmwareVersion": "2.3.4"
            },
            "ImageSettings": {
                "Width": 1000,
                "Height": 100,
                "PixelFormat": "Mono8",
                "OffsetX": 0,
                "OffsetY": 0,
                "BinningHorizontal": 1,
                "BinningVertical": 1
            },
            "AcquisitionSettings": {
                "ExposureTime": {
                    "Value": 20000,
                    "Min": 10,
                    "Max": 1000000,
                    "Unit": "microseconds"
                },
                "Gain": {
                    "Value": 1,
                    "Min": 0,
                    "Max": 48,
                    "Unit": "dB"
                },
                "AcquisitionMode": "Continuous",
                "FrameRate": {
                    "Value": 30,
                    "Min": 1,
                    "Max": 120,
                    "Unit": "fps"
                },
                "TriggerMode": "On",
                "TriggerSource": "Line1",
                "TriggerActivation": "RisingEdge"
            },
            "ColorSettings": {
                "BalanceWhiteAuto": "Continuous",
                "WhiteBalanceRed": 1.2,
                "WhiteBalanceBlue": 1.5
            },
            "NetworkSettings": {
                "IPAddress": "192.168.0.2",
                "SubnetMask": "255.255.255.0",
                "Gateway": "192.168.0.1",
                "MacAddress": "00:1C:2B:3D:4E:5F"
            },
            "UserDefinedSettings": {
                "UserSetSelector": "Default",
                "UserSetSave": True
            }, 
            "SpinningCount" : {
                "StandardBelt": 27,
                "SizeBelt": 25.4,
            },
        }

        # Ghi dữ liệu vào file JSON
        filename = os.path.join('models', f"{model_name}.json")  
        with open(filename, 'w') as json_file:
            json.dump(model_data, json_file, indent=4)

        return jsonify({
            "message": "Model created successfully",
            "file": filename,
            "data": model_data
        }), 201
    except Exception as e:
        print(f"Error creating model: {e}")
        return jsonify({"message": f"Error creating model: {e}"}), 500

# ===================================== Load Model =====================================
@app.route('/api/load_model', methods=['GET'])
def load_model():
    try:
        file_name = request.args.get('file')  # Lấy tên file từ query
        if not file_name:
            return jsonify({"message": "File name is required"}), 400

        file_path = os.path.join("models", file_name)
        if not os.path.exists(file_path):
            return jsonify({"message": f"File '{file_name}' not found"}), 404

        with open(file_path, 'r') as file:
            data = json.load(file)

        return jsonify(data), 200
    except Exception as e:
        return jsonify({"message": f"Error loading model: {e}"}), 500



# ===================================== Update Model =====================================
@app.route('/api/update_model', methods=['PUT'])
def update_model():
    try:
        # Lấy dữ liệu từ yêu cầu
        data = request.json
        file_name = data.get("file_name")
        updates = data.get("updates")

        if not file_name or not updates:
            return jsonify({"message": "File name and updates are required"}), 400

        # Đường dẫn tới file JSON
        file_path = os.path.join("models", file_name)
        if not os.path.exists(file_path):
            return jsonify({"message": f"File '{file_name}' not found"}), 404

        # Đọc dữ liệu từ file JSON
        with open(file_path, 'r') as file:
            json_data = json.load(file)

        # Hàm đệ quy để cập nhật các giá trị trong JSON
        def recursive_update(data, keys, value):
            key = keys[0]
            if len(keys) == 1:
                data[key] = value
            else:
                if key not in data or not isinstance(data[key], dict):
                    data[key] = {}
                recursive_update(data[key], keys[1:], value)

        # Thực hiện cập nhật
        for path, value in updates.items():
            keys = path.split('.')  # Phân tách đường dẫn thành các khóa
            recursive_update(json_data, keys, value)

        # Ghi lại dữ liệu đã cập nhật vào file JSON
        with open(file_path, 'w') as file:
            json.dump(json_data, file, indent=4)

        return jsonify({
            "message": "Model updated successfully",
            "file": file_path,
            "updated_data": updates
        }), 200
    except Exception as e:
        print(f"Error updating model: {e}")
        return jsonify({"message": f"Error updating model: {e}"}), 500
    
# ===================================== Read Model =====================================
@app.route("/api/read_model", methods = ['GET'])
def read_model():
    try:
        # Lấy dữ liệu được gửi đến
        model_name = request.args.get('file')
        file_name = os.path.join('models',f"{model_name}")
    
        # Kiểm tra nếu file không tồn tại
        if not os.path.exists(file_name):
            return jsonify({"message":f"File {model_name} not found"}),404

        # Đọc nội dung file json
        with open(file_name, 'r') as json_file:
            model_data = json.load(json_file)
            
        return jsonify({
            "message":"Model read successfully.",
            "data": model_data,
            "file_path": file_name,
        }), 200
    except Exception as e:
        print(f"Error reading file json: {e}")
        return jsonify({"message": f"Error reading file json: {e}"}),500


# ===================================== List Model =====================================
@app.route('/api/list_models', methods = ['GET'])
def list_models():
    try:
        directory = "models"
        # Lấy danh sách các file json trong thư mục models
        files = [f for f in os.listdir(directory) if f.endswith('.json')]
        return jsonify({"files":files}),200
    except Exception as e:
        print(f"Error listing models: {e}")
        return jsonify({"message":"Error listing models: {e}"}),500
    # ===================================== Đọc dữ liệu từ file json =====================================
@app.route("/api/read_json", methods = ['GET'])
def read_json():
    try:
        # Lấy dữ liệu được gửi đến
        model_name = request.args.get('file')
        file_name = os.path.join('data-json',f"{model_name}")
    
        # Kiểm tra nếu file không tồn tại
        if not os.path.exists(file_name):
            return jsonify({"message":f"File {model_name} not found"}),404

        # Đọc nội dung file json
        with open(file_name, 'r') as json_file:
            model_data = json.load(json_file)
            
        return jsonify({
            "message":"Model read successfully.",
            "data": model_data,
            "file_path": file_name,
        }), 200
    except Exception as e:
        print(f"Error reading file json: {e}")
        return jsonify({"message": f"Error reading file json: {e}"}),500

# =====================================  Xử lý lỗi toàn cục  ===================================== 
@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"message": f"Server error: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)


