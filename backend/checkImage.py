import os

label_path = "C:/AHSO/Camera-Control-Basler/my-electron-app - Copy/backend/dataset/labels/train"
num_classes = 3  # Số class hợp lệ (0,1,2)

for file in os.listdir(label_path):
    if file.endswith(".txt"):
        with open(os.path.join(label_path, file), "r") as f:
            lines = f.readlines()
        for line in lines:
            values = list(map(float, line.split()))
            if values[0] < 0 or values[0] >= num_classes:
                print(f"⚠️ {file} chứa class {values[0]} không hợp lệ")
            if any(v < 0 or v > 1 for v in values[1:]):
                print(f"⚠️ {file} chứa giá trị tọa độ không hợp lệ: {values[1:]}")
