"""Independent SciPy QP verification for the educational four-objective comparison preset.
Optional validation dependency: numpy, scipy, node; not needed for the site.
"""
import json
import subprocess
from pathlib import Path
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, minimize

P=Path(__file__).resolve().parents[1]
js='''import {solveForward,BASE_EDGES,objectiveWeights,capacitiesFromPercent} from './glycan-solver.mjs';
const pct={E5:25,E8:150,E7:200,E11:25,E9:150,E13:200};
const cap=capacitiesFromPercent(pct);
console.log(JSON.stringify({edges:BASE_EDGES,cap,sol:['UQ','CWQ','SU','LCRQ'].map(m=>{const r=solveForward(pct,m);return {method:m,vector:r.flowVector,profile:r.profile,objective:r.objective,F:r.maxFlow,weights:objectiveWeights(cap,m)}})}));'''
data=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=P,text=True))
E=data['edges']; C=np.array(data['cap']); nodes=['input','core','high','branch','stall','extend','finish'];
A=np.array([[int(e[1]==n)-int(e[2]==n) for e in E] for n in nodes],dtype=float)
b=np.array([120.0]+[0.0]*(len(nodes)-1))
for row in data['sol']:
    assert abs(row['F']-120)<1e-7,row
    x=np.array(row['vector']); weights=np.array(row['weights']);
    scale=weights.max(); ws=weights/scale
    def fun(t):return float(ws@(t*t))
    def jac(t):return 2*ws*t
    def hess(t):return np.diag(2*ws)
    # trust-constr is a different numerical method from the browser's ADMM solver.
    solution=minimize(fun,x,method='trust-constr',jac=jac,hess=hess,
        bounds=Bounds(np.zeros(len(E)),C),constraints=[LinearConstraint(A,b,b)],
        options={'gtol':2e-10,'xtol':1e-12,'barrier_tol':1e-11,'maxiter':3000,'verbose':0})
    assert solution.success,(row['method'],solution.message)
    assert np.max(np.abs(A@x-b))<1e-4
    assert np.max(x-C)<1e-4
    assert abs(fun(x)-fun(solution.x))<4e-5,(row['method'],fun(x),fun(solution.x))
    print('PASS',row['method'],'F=',row['F'],'profile=',{k:round(100*v,2) for k,v in row['profile'].items()},'objective relative difference=',round(fun(x)-fun(solution.x),9))
