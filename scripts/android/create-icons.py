"""Generate TubePilot's original launcher artwork without third-party imaging dependencies."""
from pathlib import Path
import struct
import zlib

SIZE, SCALE = 1024, 4
ROOT = Path(__file__).resolve().parents[2]
DARK, LIME = (38, 48, 27), (210, 245, 128)

def write_icon(name, triangles, adaptive=False):
    width=SIZE*SCALE
    mask=bytearray(width*width)
    for polygon in triangles:
        points=[(x*SCALE,y*SCALE) for x,y in polygon]
        for y in range(min(p[1] for p in points),max(p[1] for p in points)):
            intersections=[]
            for a,b in zip(points,points[1:]+points[:1]):
                if min(a[1],b[1])<=y+.5<max(a[1],b[1]):
                    intersections.append(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]))
            if len(intersections)==2:
                left,right=sorted(int(x) for x in intersections)
                mask[y*width+left:y*width+right]=b'\x01'*(right-left)
    raw=bytearray()
    for y in range(SIZE):
        raw.append(0)
        for x in range(SIZE):
            count=sum(mask[(y*SCALE+dy)*width+x*SCALE:(y*SCALE+dy)*width+x*SCALE+SCALE].count(1) for dy in range(SCALE))
            if adaptive:
                raw.extend((*DARK,round(255*count/(SCALE*SCALE))))
            else:
                raw.extend(round(bg+(fg-bg)*count/(SCALE*SCALE)) for bg,fg in zip(LIME,DARK))
                raw.append(255)
    def chunk(kind,data):
        return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    output=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',SIZE,SIZE,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
    (ROOT/'apps/mobile/assets'/name).write_bytes(output)

if __name__=='__main__':
    write_icon('app-icon.png',[[(402,273),(790,512),(402,751)],[(210,374),(410,512),(210,650)]])
    write_icon('adaptive-foreground.png',[[(447,340),(731,512),(447,684)],[(302,408),(453,512),(302,616)]],True)
