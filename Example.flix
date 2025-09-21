instance Collection[Set[a]] with Order[a] {
    type Elm = a
    pub def empty(): Set[a] = Set.empty()
    pub def insert(x: a, c: Set[a]): Set[a] = Set.insert(x, c)
    pub def toList(c: Set[a]): List[a] = Set.toList(c)
}
