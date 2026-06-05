import shutil
import os
from PIL import Image

src_img = r'C:\Users\user\.gemini\antigravity-ide\brain\270143e8-2190-41f2-a1f5-86d6386478c8\safesweep_logo_pureblack_1780669284407.png'
dest_png = r'C:\Users\user\Desktop\Cleaner\src-ui\public\icon.png'
dest_ico = r'C:\Users\user\Desktop\Cleaner\build\icon.ico'

# Copy to public folder for React/Vite
shutil.copyfile(src_img, dest_png)

# Convert to ico for Electron Builder
img = Image.open(src_img)
img.save(dest_ico, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32)])
print("Icons successfully created!")
