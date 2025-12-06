
import matplotlib.pyplot as plt
import matplotlib.patches as patches

functions = ["water","education","green","work","streets","tree","temperature","biodiversity","pollution"]

fig, ax = plt.subplots(figsize=(8,8))
living_center=(0.3,0.5)
living_radius=0.2
ax.add_patch(patches.Circle(living_center,living_radius,fill=True,color='#f3c6e5',alpha=0.8))
plt.text(*living_center,"living",ha='center',va='center')

centers=[(0.6,0.75),(0.75,0.6),(0.75,0.4),(0.6,0.25),(0.45,0.2),
         (0.3,0.25),(0.18,0.3),(0.15,0.45),(0.2,0.65)]
radii=[0.1]*len(functions)

for (cx,cy),r,name in zip(centers,radii,functions):
    ax.add_patch(patches.Circle((cx,cy),r,fill=False,linestyle='--',color='#3b7dad',linewidth=2))
    plt.text(cx,cy,name,ha='center',va='center',fontsize=9)

for (cx,cy),name in zip(centers,functions):
    plt.plot([living_center[0],cx],[living_center[1],cy],color='#3b7dad',linewidth=1)

border = patches.Circle((0.5,0.5),0.48,fill=False,linestyle='--',color='#57c5c8',linewidth=2)
ax.add_patch(border)

ax.set_xlim(0,1)
ax.set_ylim(0,1)
ax.set_aspect('equal')
ax.axis('off')
plt.savefig("circles.png",dpi=300)
