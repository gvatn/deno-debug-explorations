function add(a: number, b: number) {
    console.log("Adding ", a, b);
    return a + b;
}

function mul(a: number, b: number) {
    return a * b;
}

let x = mul(3, add(1, 2));
console.log(x);