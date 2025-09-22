pub lawful trait Applicative[m : Type -> Type] with Functor[m] {
    ///
    /// Puts `x` into a default context.
    ///
    pub def point(x: a): m[a]

    ///
    /// Apply the function-type applicative `f` to the argument-type applicative `x`.
    ///
    pub def ap(f: m[a -> b \ ef], x: m[a]): m[b] \ ef

    ///
    /// Lift a binary function to work on `Applicative`s.
    /// Instances can define more efficient implementations than the default implementation
    /// (which is `Applicative.ap(Functor.map(f, x1), x2)`).
    ///
    pub def map2(f: t1 -> t2 -> r \ ef, x1: m[t1], x2: m[t2]): m[r] \ ef = Applicative.ap(Functor.map(f, x1), x2)
}
