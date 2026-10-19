#!/bin/bash
# corre toda la regresión y deja el resumen en /tmp/regress.txt
export PATH=/tmp/infra/node/node_modules/.bin:$PATH
out=/tmp/regress.txt; : > $out
cd /tmp/rave/t
for t in v1 v2 v3 v4 v5 v6 v7 v8 d1 p1 ws1; do
  r=$(timeout 280 python3 $t.py 2>&1 | tail -30); n=$(echo "$r" | grep -c '^FALLA'); l=$(echo "$r" | tail -1)
  echo "$t | fallas=$n | $l" >> $out; echo "$r" | grep '^FALLA' >> $out
done
for t in c1 c2 c3 c4 c5 c6 c7 c8 c9 c10 c11 c12 c13 c14 c15 c16 c17 c18 c19 c20 p2 a1 s1; do
  r=$(timeout 330 bash run_c.sh $t.py 2>&1 | tail -40); n=$(echo "$r" | grep -c '^FALLA'); l=$(echo "$r" | tail -1)
  echo "$t | fallas=$n | $l" >> $out; echo "$r" | grep '^FALLA' >> $out
done
echo FIN >> $out
