import os
import shutil
import yaml
import glob
from ultralytics import YOLO

# Xóa thư mục cache 'runs' để đảm bảo không dùng dữ liệu cũ
runs_dir = os.path.abspath("./runs")
if os.path.exists(runs_dir):
    shutil.rmtree(runs_dir)
    print("✅ Đã xóa thư mục cache 'runs'.")

# Đường dẫn file data.yaml và kiểm tra tồn tại
data_yaml_path = os.path.abspath("./dataset/data.yaml")
print("📄 Đường dẫn đầy đủ của data.yaml:", data_yaml_path)
if not os.path.exists(data_yaml_path):
    raise FileNotFoundError(f"❌ Không tìm thấy file: {data_yaml_path}")

# Đọc nội dung data.yaml
with open(data_yaml_path, "r", encoding="utf-8") as file:

    data_yaml = yaml.safe_load(file)
    print("🔍 Nội dung data.yaml:", data_yaml)

# Kiểm tra danh sách hình ảnh trong tập train và val
train_images = glob.glob(os.path.join(data_yaml["train"], "*.bmp"))
val_images = glob.glob(os.path.join(data_yaml["val"], "*.bmp"))

print(f"📸 Số ảnh trong tập train: {len(train_images)}")
print(f"📸 Số ảnh trong tập val: {len(val_images)}")
print(f"🔗 Một số ảnh trong train: {train_images[:5]}")

# Kiểm tra danh sách ảnh trong dataset
train_images = glob.glob(os.path.join(data_yaml["train"], "*.bmp"))
val_images = glob.glob(os.path.join(data_yaml["val"], "*.bmp"))

print(f"📸 Số ảnh trong tập train: {len(train_images)}")
print(f"📸 Số ảnh trong tập val: {len(val_images)}")
print(f"🔗 Một số ảnh trong train: {train_images[:5]}")

# Xóa cache YOLO nếu có
cache_dir = os.path.expanduser("~/.cache/ultralytics")
if os.path.exists(cache_dir):
    shutil.rmtree(cache_dir)
    print("🗑️ Đã xóa cache YOLO.")

# Khởi tạo mô hình YOLO
model = YOLO("yolov8n.pt")

# Kiểm tra thông tin dữ liệu của YOLO
if hasattr(model, "data"):
    print("📌 YOLO đang sử dụng dataset:", model.data)
else:
    print("⚠️ Không tìm thấy thông tin dataset từ mô hình!")

# Huấn luyện mô hình với dữ liệu mới
model.train(
    data=data_yaml_path,
    epochs=10,
    imgsz=640,
    batch=2,
    workers=1,
    cache=False,
    resume=False  # Đảm bảo không tiếp tục từ checkpoint cũ
)

# Xóa kết quả training cũ (nếu có)
shutil.rmtree("./runs/detect/train", ignore_errors=True)

print("✅ Training completed. Weights saved in runs/detect/train/weights/best.pt")
