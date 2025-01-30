import sympy
from sympy import symbols
from sympy.solvers.solveset import linsolve

x,a,b,Ts,Ps,A,B,Te,Pe,Pm = symbols("x,a,b,Ts,Ps,A,B,Te,Pe,Pm")

f1 = a*x**3 + b*x**2 + Ts*x + Ps
f2 = A*(x-1)**3 + B*(x-1)**2 + Te*(x-1) + Pe
df1 = 3*a*x**2 + 2*b*x + Ts
df2 = 3*A*(x-1)**2 + 2*B*(x-1) + Te

sol = linsolve(
	[
		f1.subs(x, 1/2) - Pm,
		f2.subs(x, 1/2) - Pm,
		f1.subs(x, 1/2) - f2.subs(x, 1/2),
		df1.subs(x, 1/2) - df2.subs(x, 1/2)
	],
	(a,b,A,B)
)
print(sol)
for e in sol:
	print(e[0]+e[1])