# ===== 쉬운 설명 =====
# 무엇: 로그인 화면 사진의 색감·질감을 맞추는 스크립트(파란 톤 + 채도 낮춤 + 살짝 흐림 + 고운 입자감)
#      그리고 화면 칸 모양(약 6:5)에 맞게 잘라 public/login/slide-N.jpg 로 저장합니다.
# 언제: 로그인 사진을 바꿀 때. 실행: python3 scripts/grade-login-photos.py <원본사진폴더>
# 리뷰 포인트: jobs 의 '잘라낼 영역(x0,y0,w,h)'을 사진마다 인물이 가운데 오도록 정하세요. (Pillow, numpy 필요)
# =====================
import sys, numpy as np
from PIL import Image, ImageFilter, ImageEnhance
U=(sys.argv[1].rstrip('/')+'/') if len(sys.argv)>1 else './'  # 원본 사진 폴더
# (원본, 잘라낼 영역 x0,y0,w,h, 결과 이름)
jobs=[('mv-fotos-woman-10113152_1920.png',(100,0,1721,1434),'slide-1'),
      ('telesolutionscallcentr-call-center-8754751_1920.jpg',(388,0,1532,1277),'slide-2'),
      ('snehaltechnotery-woman-6573021_1920.jpg',(280,0,1536,1280),'slide-3'),
      ('hillside7-telemedicine-7520691_1920.jpg',(0,600,1280,1067),'slide-4')]
SH=np.array([14,32,84],float)/255   # 그림자 쪽 남색
HI=np.array([226,236,255],float)/255 # 밝은 쪽 연하늘
rng=np.random.default_rng(7)
for src,(x,y,w,h),name in jobs:
    im=Image.open(U+src).convert('RGB').crop((x,y,x+w,y+h))
    if im.width>1800: im=im.resize((1800,round(1800*im.height/im.width)),Image.LANCZOS)
    im=ImageEnhance.Color(im).enhance(0.55)
    a=np.asarray(im).astype(float)/255
    lum=(a@[0.299,0.587,0.114])[...,None]
    duo=SH+(HI-SH)*lum
    a=a*0.62+duo*0.38                       # 브랜드 색으로 색감 통일
    a=0.06+a*0.9                            # 검은색을 살짝 띄워 부드럽게
    im=Image.fromarray((np.clip(a,0,1)*255).astype('uint8'))
    im=im.filter(ImageFilter.GaussianBlur(1.1)) # 유리 너머로 보는 듯한 부드러움
    g=rng.normal(0,6,(im.height,im.width,1))
    a=np.clip(np.asarray(im).astype(float)+g,0,255).astype('uint8') # 고운 입자감
    Image.fromarray(a).save(f'public/login/{name}.jpg',quality=78,optimize=True,progressive=True)
    print(name, Image.open(f'public/login/{name}.jpg').size)
