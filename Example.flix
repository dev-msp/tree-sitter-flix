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

    ///
    /// Lift a ternary function to work on `Applicative`s.
    /// Instances can define more efficient implementations than the default implementation
    /// (which is `Applicative.ap(Applicative.map2(f, x1, x2), x3)`).
    ///
    pub def map3(f: t1 -> t2 -> t3 -> r \ ef, x1: m[t1], x2: m[t2], x3: m[t3]): m[r] \ ef = Applicative.ap(Applicative.map2(f, x1, x2), x3)

    ///
    /// Lift a 4-ary function to work on `Applicative`s.
    /// Instances can define more efficient implementations than the default implementation
    /// (which is `Applicative.ap(Applicative.map3(f, x1, x2, x3), x4)`).
    ///
    pub def map4(f: t1 -> t2 -> t3 -> t4 -> r \ ef, x1: m[t1], x2: m[t2], x3: m[t3], x4: m[t4]): m[r] \ ef = Applicative.ap(Applicative.map3(f, x1, x2, x3), x4)

    ///
    /// Lift a 5-ary function to work on `Applicative`s.
    /// Instances can define more efficient implementations than the default implementation
    /// (which is `Applicative.ap(Applicative.map3(f, x1, x2, x3), x4)`).
    ///
    pub def map5(f: t1 -> t2 -> t3 -> t4 -> t5 -> r \ ef, x1: m[t1], x2: m[t2], x3: m[t3], x4: m[t4], x5: m[t5]): m[r] \ ef = Applicative.ap(Applicative.map4(f, x1, x2, x3, x4), x5)

    ///
    /// Applying the identity function wrapped into an applicative preserves every applicative value.
    ///
    law identity: forall(x: m[a]) with Eq[m[a]] Applicative.ap(Applicative.point(identity), x) == x

    ///
    /// Applicatively composing two functions and then applicatively applying the resulting function is the same
    /// as applicatively applying the functions one by one.
    ///
    law composition: forall(f: m[b -> c], g: m[a -> b], v: m[a]) with Eq[m[c]] Applicative.ap(Applicative.ap(Applicative.ap(Applicative.point((f, g) -> g >> f), f), g), v) == Applicative.ap(f, Applicative.ap(g, v))

    ///
    /// `point` is a homomorphism from normal to applicative values regarding application (normal vs. applicative).
    ///
    // TODO error in type checker does not allow to compile this, see #2099
    // law homomorphism: forall(f: a -> b, x: a) with Eq[m[b]] Applicative.ap(Applicative.point(f), Applicative.point(x)) == Applicative.point(f(x))

    ///
    /// Directly applicatively applying a function `f` to an argument `x` put into a default context is the same as putting the function that takes a function and applies it to `x` into a default context and applicatively applying it to `f`.
    ///
    law interchange: forall(f: m[a -> b], x: a) with Eq[m[b]] Applicative.ap(f, Applicative.point(x)) == Applicative.ap(Applicative.point(f -> f(x)), f)

    ///
    /// `map2` is equivalent to its default implementation.
    ///
    law map2Correspondence: forall(f: t1 -> t2 -> r, x1: m[t1], x2: m[t2]) with Eq[m[r]] Applicative.map2(f, x1, x2) == Applicative.ap(Functor.map(f, x1), x2)

    ///
    /// `map3` is equivalent to its default implementation.
    ///
    law map3Correspondence: forall(f: t1 -> t2 -> t3 -> r, x1: m[t1], x2: m[t2], x3: m[t3]) with Eq[m[r]] Applicative.map3(f, x1, x2, x3) == Applicative.ap(Applicative.map2(f, x1, x2), x3)

    ///
    /// `map4` is equivalent to its default implementation.
    ///
    law map4Correspondence: forall(f: t1 -> t2 -> t3 -> t4 -> r, x1: m[t1], x2: m[t2], x3: m[t3], x4: m[t4]) with Eq[m[r]] Applicative.map4(f, x1, x2, x3, x4) == Applicative.ap(Applicative.map3(f, x1, x2, x3), x4)

    ///
    /// `map5` is equivalent to its default implementation.
    ///
    law map5Correspondence: forall(f: t1 -> t2 -> t3 -> t4 -> t5 -> r, x1: m[t1], x2: m[t2], x3: m[t3], x4: m[t4], x5: m[t5]) with Eq[m[r]] Applicative.map5(f, x1, x2, x3, x4, x5) == Applicative.ap(Applicative.map4(f, x1, x2, x3, x4), x5)

    ///
    /// Mapping a function over an applicative (with `Functor.map`) is the same as putting the function
    /// into a default context and applying it to the applicative.
    ///
    law mapCorrespondence: forall(f: a -> b, x: m[a]) with Eq[m[b]] Functor.map(f, x) == Applicative.ap(Applicative.point(f), x)
}
