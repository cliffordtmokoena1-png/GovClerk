python3 -m pip install -r requirements.txt

# TODO: check if ffmpeg is installed from
# `curl https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz > ffmpeg-release-i686-static.tar.xz`

# sudo yum install certbot
# Renew certs, setup nginx, proxy https to localhost:8000

PATH=$PATH:/home/ec2-user/govclerk-minutes-service/ffmpeg/ffmpeg-6.0-i686-static gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app